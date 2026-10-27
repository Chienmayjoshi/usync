-- usync M3: push notifications with the budget enforced here, not in the app.
-- Thanks and the Sync reveal go out right away (positive news has no budget). New hands are
-- batched into a morning and an evening push, nudges are capped at two a day, and nothing
-- arrives in quiet hours. A pg_cron tick does the batching; pg_net posts to Expo's push API.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Quiet hours in the person's local time. Defaults match the spec: 22:00 to 08:00, India.
alter table public.members
  add column tz text not null default 'Asia/Kolkata',
  add column quiet_start smallint not null default 22 check (quiet_start between 0 and 23),
  add column quiet_end smallint not null default 8 check (quiet_end between 0 and 23);

-- One row per phone. A phone that signs into another account moves with it.
create table public.push_tokens (
  token text primary key,
  member uuid not null references public.members (id) on delete cascade,
  platform text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "my phones" on public.push_tokens for select using (member = auth.uid());

-- Everything we send or will send. It is also the ledger the budget counts against, and the
-- source of in app banners on phones that cannot get push.
create table public.push_outbox (
  id bigint generated always as identity primary key,
  member uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('thanks', 'sync', 'hand', 'nudge')),
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_outbox_due_idx on public.push_outbox (send_after) where sent_at is null;
create index push_outbox_member_idx on public.push_outbox (member, kind, created_at);
alter table public.push_outbox enable row level security;
create policy "my notifications" on public.push_outbox for select using (member = auth.uid());

create function public.register_push_token(token text, platform text) returns void
language sql security definer set search_path = public as $$
  insert into push_tokens (token, member, platform) values (token, auth.uid(), platform)
  on conflict (token) do update set member = auth.uid(), platform = excluded.platform, updated_at = now();
$$;

create function public.forget_push_token(token text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where push_tokens.token = forget_push_token.token and member = auth.uid();
$$;

-- "Call the electrician" reads as "call the electrician" mid sentence; Goa stays Goa.
create function public.mid(t text) returns text
language sql immutable as $$ select lower(left(t, 1)) || substr(t, 2) $$;

create function public.in_quiet(h int, qs int, qe int) returns boolean
language sql immutable as $$
  select case when qs > qe then h >= qs or h < qe else h >= qs and h < qe end
$$;

-- When a push to this person may go out: now, or the end of their quiet hours.
create function public.push_ready_at(m public.members) returns timestamptz
language sql stable as $$
  select case
    when not public.in_quiet(extract(hour from l)::int, m.quiet_start, m.quiet_end) then now()
    else (date_trunc('day', l) + make_interval(hours => m.quiet_end)
      + case when extract(hour from l) >= m.quiet_end then interval '1 day' else interval '0' end) at time zone m.tz
  end
  from (select now() at time zone m.tz as l) x
$$;

-- Send everything that is due, in batches of 100 (Expo's limit). Rows for people with no phone
-- registered are still marked sent: the app shows them as banners when it opens.
create function public.push_flush() returns int
language plpgsql security definer set search_path = public as $$
declare
  ids bigint[];
  msgs jsonb;
  n int := 0;
begin
  with due as (
    select id from push_outbox where sent_at is null and send_after <= now() for update skip locked
  ), sent as (
    update push_outbox o set sent_at = now() from due where o.id = due.id returning o.id
  )
  select array_agg(id) into ids from sent;
  if ids is null then return 0; end if;

  for msgs in
    select jsonb_agg(m) from (
      select jsonb_build_object(
        'to', t.token, 'title', o.title, 'body', o.body, 'sound', 'default', 'channelId', 'default',
        'data', o.data || jsonb_build_object('kind', o.kind)
      ) as m, (row_number() over () - 1) / 100 as batch
      from push_outbox o join push_tokens t on t.member = o.member
      where o.id = any (ids)
    ) b group by batch
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := msgs,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    n := n + jsonb_array_length(msgs);
  end loop;
  return n;
end $$;

-- A heart reaches the partner straight away (or when their quiet hours end).
create function public.notify_thanks() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sender members;
  them members;
  what text;
begin
  select * into sender from members where id = new.from_member;
  select * into them from members where couple_id = new.couple_id and id <> new.from_member;
  if them.id is null then return new; end if;
  select title into what from tasks where id = new.task_id;
  insert into push_outbox (member, kind, title, body, data, send_after)
  values (them.id, 'thanks', coalesce(sender.name, 'Your partner') || ' sent a heart',
    coalesce('for “' || public.mid(what) || '”', 'for something you did'),
    jsonb_build_object('task_id', new.task_id), public.push_ready_at(them));
  perform public.push_flush();
  return new;
end $$;
create trigger thanks_push after insert on public.thanks for each row execute function public.notify_thanks();

-- When the second appreciation lands, both are revealed: tell the one who wrote first.
create function public.notify_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  writer members;
  them members;
begin
  if (select count(*) from sync_entries where couple_id = new.couple_id and week_start = new.week_start) <> 2 then
    return new;
  end if;
  select * into writer from members where id = new.member;
  select * into them from members where couple_id = new.couple_id and id <> new.member;
  if them.id is null then return new; end if;
  insert into push_outbox (member, kind, title, body, data, send_after)
  values (them.id, 'sync', 'Sunday Sync is open', writer.name || ' wrote something for you.',
    jsonb_build_object('week', new.week_start), public.push_ready_at(them));
  perform public.push_flush();
  return new;
end $$;
create trigger sync_push after insert on public.sync_entries for each row execute function public.notify_sync();

-- The tick, every ten minutes. Queues at most one new hand per slot (09:00 and 18:00 local)
-- and at most two gentle nudges a day between 10:00 and 20:00, then sends what is due.
create function public.push_tick() returns int
language plpgsql security definer set search_path = public as $$
declare
  m members;
  l timestamp;
  day_start timestamptz;
  last_hand timestamptz;
  fresh text[];
  stale tasks;
begin
  for m in select * from members where couple_id is not null loop
    l := now() at time zone m.tz;
    if public.in_quiet(extract(hour from l)::int, m.quiet_start, m.quiet_end) then continue; end if;
    day_start := date_trunc('day', l) at time zone m.tz;

    -- New hand: cards dealt or traded to me since my last hand push, never my own drops to myself.
    if extract(hour from l) in (9, 18)
      and (select count(*) from push_outbox where member = m.id and kind = 'hand' and created_at >= day_start) < 2
    then
      select max(created_at) into last_hand from push_outbox where member = m.id and kind = 'hand';
      if last_hand is null or last_hand < now() - interval '6 hours' then
        select array_agg(title order by created_at) into fresh from tasks
        where couple_id = m.couple_id and status = 'deal' and owner = m.side
          and updated_at > coalesce(last_hand, '-infinity')
          and (dropped_by is distinct from m.id or traded);
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

    -- Nudge: one card of mine untouched for three days, not nudged about in the last three.
    -- About the card, never about the person, and never mentioning the partner.
    if extract(hour from l) between 10 and 19
      and (select count(*) from push_outbox where member = m.id and kind = 'nudge' and created_at >= day_start) < 2
      and not exists (select 1 from push_outbox where member = m.id and kind = 'nudge' and created_at > now() - interval '4 hours')
    then
      select t.* into stale from tasks t
      where t.couple_id = m.couple_id and t.status = 'active' and t.owner in (m.side, 'together')
        and t.sort_at < now() - interval '3 days'
        and not exists (select 1 from push_outbox o where o.member = m.id and o.kind = 'nudge'
          and o.data ->> 'task_id' = t.id::text and o.created_at > now() - interval '3 days')
      order by t.sort_at limit 1;
      if stale.id is not null then
        insert into push_outbox (member, kind, title, body, data) values (m.id, 'nudge',
          'Still on your deck', stale.title || '. A good moment for it? If not, slide it to later.',
          jsonb_build_object('task_id', stale.id));
      end if;
    end if;
  end loop;

  -- Phones Expo says are gone (app removed, token rotated) stop getting pushes.
  delete from push_tokens where token in (
    select d -> 'details' ->> 'expoPushToken'
    from (select case when content like '%DeviceNotRegistered%' then content::jsonb -> 'data' end as data
          from net._http_response where created > now() - interval '1 hour') r,
      jsonb_array_elements(case when jsonb_typeof(r.data) = 'array' then r.data else '[]' end) d
    where d -> 'details' ->> 'error' = 'DeviceNotRegistered'
  );

  return public.push_flush();
end $$;

revoke execute on function public.push_flush, public.push_tick, public.notify_thanks, public.notify_sync from anon, authenticated, public;
revoke execute on function public.register_push_token, public.forget_push_token from anon;

select cron.schedule('usync-push-tick', '*/10 * * * *', 'select public.push_tick()');
