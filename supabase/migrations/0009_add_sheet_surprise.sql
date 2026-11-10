-- The new add-task sheet, and surprises with a reveal date.
--
-- Every new card carries the date its priority stands for (due_on). A surprise is always the
-- dropper's own and lives on their deck until it is revealed (done). Swiping it left pushes the
-- reveal back a day; left alone, an overdue reveal simply rolls on to today (the app shows
-- greatest(due_on, today)), so nothing has to run at midnight. Revealing it tells the partner.

alter table public.tasks add column due_on date;

-- Push a surprise's reveal back (days > 0) or undo that (days < 0). Mine, active surprises only.
create or replace function public.postpone_surprise(task uuid, days int default 1) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  me members;
  t tasks;
  today date;
begin
  select * into me from members where id = auth.uid();
  select * into t from tasks where id = task and couple_id = me.couple_id;
  if t.id is null or not t.surprise or t.dropped_by <> me.id or t.status <> 'active' then
    raise exception 'Card not found.';
  end if;
  today := (now() at time zone me.tz)::date;
  update tasks set due_on = greatest(coalesce(t.due_on, today), today) + days, updated_at = now()
    where id = t.id returning * into t;
  insert into task_events (task_id, couple_id, actor, kind, text)
    values (t.id, t.couple_id, me.id, 'postpone', 'Reveal moved to ' || to_char(t.due_on, 'Dy, DD Mon'));
  return t;
end $$;
revoke execute on function public.postpone_surprise from anon;

-- A finished card tells the partner; a surprise says it is one.
create or replace function public.notify_done() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  doer members;
  them members;
begin
  if new.status <> 'done' or old.status = 'done' or new.done_by is null then return new; end if;
  select * into doer from members where id = new.done_by;
  select * into them from members where couple_id = new.couple_id and id <> new.done_by;
  if them.id is null then return new; end if;
  if not new.surprise and (select count(*) from push_outbox where member = them.id and kind = 'done'
      and created_at >= date_trunc('day', now() at time zone them.tz) at time zone them.tz) >= 6 then
    return new;
  end if;
  insert into push_outbox (member, kind, title, body, data, send_after)
  values (them.id, 'done',
    case when new.surprise then doer.name || ' has a surprise for you 🎁' else doer.name || ' finished ' || public.mid(new.title) end,
    case when new.surprise then new.title else 'Send a heart if it made your day lighter.' end,
    jsonb_build_object('task_id', new.id, 'surprise', new.surprise), public.push_ready_at(them));
  perform public.push_flush();
  return new;
end $$;

-- push_tick from 0007, with surprises left out of the mascot nudges: the partner's mascot
-- would otherwise nag me about the surprise I am keeping for that same partner.
create or replace function public.push_tick() returns int
language plpgsql security definer set search_path = public as $$
declare
  m members;
  p members;
  l timestamp;
  day_start timestamptz;
  last_hand timestamptz;
  fresh text[];
  stale record;
begin
  for m in select * from members where couple_id is not null loop
    l := now() at time zone m.tz;
    if public.in_quiet(extract(hour from l)::int, m.quiet_start, m.quiet_end) then continue; end if;
    day_start := date_trunc('day', l) at time zone m.tz;

    if extract(hour from l) in (9, 18)
      and (select count(*) from push_outbox where member = m.id and kind = 'hand' and created_at >= day_start) < 2
    then
      select max(created_at) into last_hand from push_outbox where member = m.id and kind = 'hand';
      if last_hand is null or last_hand < now() - interval '6 hours' then
        select array_agg(title order by created_at) into fresh from tasks t
        where t.couple_id = m.couple_id and t.status = 'deal' and t.owner = m.side
          and t.updated_at > coalesce(last_hand, '-infinity')
          and (t.dropped_by is distinct from m.id or t.traded)
          and t.request is null and not t.surprise
          and not exists (select 1 from push_outbox o where o.member = m.id and o.kind in ('drop', 'request')
            and o.data -> 'task_ids' ? t.id::text);
        if fresh is not null then
          insert into push_outbox (member, kind, title, body, data) values (m.id, 'hand',
            case when cardinality(fresh) = 1 then 'A new card on your deck' else cardinality(fresh) || ' new cards on your deck' end,
            case cardinality(fresh)
              when 1 then fresh[1] || '. Take it, trade it or do it together.'
              when 2 then fresh[1] || ' and ' || public.mid(fresh[2]) || '.'
              else fresh[1] || ', ' || public.mid(fresh[2]) || ' and ' || (cardinality(fresh) - 2) || ' more.'
            end,
            '{}');
        end if;
      end if;
    end if;

    -- Mascot nudges: cards I'm sitting on, our together cards, and Table cards nobody took.
    -- The most ignored first; a card comes back sooner the firmer it has got, a Table card at
    -- most every 3 days. Still at most 2 a day, 4 hours apart, between 10:00 and 19:59.
    if extract(hour from l) between 10 and 19
      and (select count(*) from push_outbox where member = m.id and kind = 'nudge' and created_at >= day_start) < 2
      and not exists (select 1 from push_outbox where member = m.id and kind = 'nudge' and created_at > now() - interval '4 hours')
    then
      select t.id, t.title, t.sort_at, c.kind, c.lvl into stale
      from tasks t
      cross join lateral (select
        case when t.owner = 'table' then 'table' else 'mine' end as kind,
        public.nudge_level(t.sort_at, m.nudge_max) as lvl) c
      where t.couple_id = m.couple_id
        and not t.surprise
        and ((t.status = 'active' and t.owner in (m.side, 'together'))
          or (t.status = 'deal' and t.owner = 'table' and t.request is null and not t.surprise))
        and c.lvl >= 1
        and not exists (select 1 from push_outbox o where o.member = m.id and o.kind = 'nudge'
          and o.data ->> 'task_id' = t.id::text
          and o.created_at > now() - case
            when c.kind = 'table' then interval '3 days'
            when c.lvl = 3 then interval '1 day'
            when c.lvl = 2 then interval '2 days'
            else interval '3 days' end)
      order by c.lvl desc, t.sort_at
      limit 1;
      if stale.id is not null then
        select * into p from members where couple_id = m.couple_id and id <> m.id;
        insert into push_outbox (member, kind, title, body, data) values (m.id, 'nudge',
          coalesce(p.name, 'usync'),
          format(public.nudge_line(stale.kind, stale.lvl, public.nudge_seed(stale.id, l::date), coalesce(p.voice, 'neutral')), stale.title),
          jsonb_build_object('task_id', stale.id, 'level', stale.lvl, 'kind', stale.kind, 'from', p.id));
      end if;
    end if;
  end loop;

  delete from push_tokens where token in (
    select d -> 'details' ->> 'expoPushToken'
    from (select case when content like '%DeviceNotRegistered%' then content::jsonb -> 'data' end as data
          from net._http_response where created > now() - interval '1 hour') r,
      jsonb_array_elements(case when jsonb_typeof(r.data) = 'array' then r.data else '[]' end) d
    where d -> 'details' ->> 'error' = 'DeviceNotRegistered'
  );

  return public.push_flush();
end $$;
revoke execute on function public.push_tick from anon, authenticated, public;
