-- usync: fixes from the first two phone test.
-- Profile color and avatar, hearts with a note that stay until read, freer deck moves
-- (done straight from a deal, trade or table a card already on my deck, skip a deal for now),
-- and pushes when the partner drops something or finishes a job.

-- Profile: a color each (never the same as the partner's) and an optional emoji avatar.
alter table public.members
  add column color text not null default 'ember' check (color in ('ember', 'lagoon', 'violet', 'lime', 'sky', 'rose')),
  add column avatar text check (char_length(avatar) <= 16);
update public.members set color = 'lagoon' where side = 'b';

-- Joining takes a free color if the partner already has mine.
create or replace function public.join_space(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  taken int;
  theirs text;
  mine text;
begin
  select id into cid from couples where invite_code = upper(trim(code));
  if cid is null then raise exception 'That code does not match a space.'; end if;
  if public.my_couple() = cid then return cid; end if;
  if public.my_couple() is not null then raise exception 'You are already in a space. Leave it first.'; end if;
  select count(*) into taken from members where couple_id = cid;
  if taken >= 2 then raise exception 'That space already has two people.'; end if;
  select color into theirs from members where couple_id = cid;
  select color into mine from members where id = auth.uid();
  if mine = theirs then mine := case when theirs = 'lagoon' then 'ember' else 'lagoon' end; end if;
  update members set couple_id = cid, side = 'b', color = mine where id = auth.uid();
  return cid;
end $$;

-- Hearts: an optional line, and stay on screen until the partner has seen them.
alter table public.thanks
  add column note text check (char_length(note) <= 200),
  add column seen_at timestamptz;

create function public.ack_thanks(heart bigint) returns void
language sql security definer set search_path = public as $$
  update thanks set seen_at = now()
  where id = heart and couple_id = public.my_couple() and from_member <> auth.uid() and seen_at is null;
$$;

create or replace function public.notify_thanks() returns trigger
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
    coalesce('“' || nullif(trim(new.note), '') || '”', 'for “' || public.mid(what) || '”', 'for something you did'),
    jsonb_build_object('task_id', new.task_id, 'thanks_id', new.id), public.push_ready_at(them));
  perform public.push_flush();
  return new;
end $$;

-- Deck moves. New since M1:
--   done   straight from a deal (either partner can close any card, credit goes to the doer)
--   trade  also from a card already on my deck; it goes back to being a deal
--   table  put a deal or a card on my deck on the open table, no trade needed
--   later  also skips a deal for now: it goes to the back of the pile, still undecided
create or replace function public.deck_move(task uuid, move text) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  me members;
  other text;
  note text;
  mine boolean;
begin
  select * into me from members where id = auth.uid();
  select * into t from tasks where id = task and couple_id = me.couple_id for update;
  if t.id is null then raise exception 'Card not found.'; end if;
  other := case me.side when 'a' then 'b' else 'a' end;
  mine := t.owner = me.side;

  if move = 'take' and t.status = 'deal' then
    t.owner := me.side; t.status := 'active'; note := me.name || ' took it';
  elsif move = 'together' and t.status = 'deal' then
    t.owner := 'together'; t.status := 'active'; note := 'Doing it together';
  elsif move = 'trade' and (t.status = 'deal' or (t.status = 'active' and mine)) then
    -- One trade per card. After that a pass sends it to the open table, never back and forth.
    if not t.traded then
      t.owner := other; t.traded := true; t.status := 'deal'; note := me.name || ' traded it';
    else
      t.owner := 'table'; t.status := 'deal'; note := me.name || ' passed it to the open table';
    end if;
  elsif move = 'table' and t.owner <> 'table' and (t.status = 'deal' or (t.status = 'active' and mine)) then
    t.owner := 'table'; t.status := 'deal'; note := me.name || ' put it on the open table';
  elsif move = 'grab' and t.owner = 'table' and t.status <> 'done' then
    t.owner := me.side; t.status := 'active'; note := me.name || ' grabbed it from the table';
  elsif move = 'later' and t.status in ('deal', 'active') then
    note := case when t.status = 'deal' then 'Skipped for now' else 'Moved to later' end;
  elsif move = 'done' and t.status in ('deal', 'active', 'waiting') then
    if t.status = 'deal' and t.owner <> 'together' then t.owner := me.side; end if;
    t.status := 'done'; t.done_by := me.id; t.done_at := now(); note := 'Done by ' || me.name;
  else
    raise exception 'That move is not allowed for this card.';
  end if;

  -- Taken, shared or postponed cards go to the back so the next card comes up.
  if move in ('take', 'together', 'later', 'trade', 'table') then t.sort_at := now(); end if;
  update tasks set owner = t.owner, status = t.status, traded = t.traded, done_by = t.done_by, done_at = t.done_at,
    sort_at = t.sort_at, updated_at = now() where id = t.id returning * into t;
  insert into task_events (task_id, couple_id, actor, kind, text) values (t.id, t.couple_id, me.id, move, note);
  return t;
end $$;

-- Two new kinds of push: the partner dropped something, the partner finished a job.
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('thanks', 'sync', 'hand', 'nudge', 'drop', 'done'));

-- One push per drop line (a line can split into several cards), at most four a day, quiet
-- hours respected. Cards dealt to the partner are said so, so they know what is theirs.
create function public.notify_drop() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dropper members;
  them members;
  titles text[];
  mine int;
  ids jsonb;
begin
  for dropper in
    select m.* from members m where m.id in (select distinct actor from new_rows where kind = 'drop')
  loop
    select * into them from members where couple_id = dropper.couple_id and id <> dropper.id;
    if them.id is null then continue; end if;
    if (select count(*) from push_outbox where member = them.id and kind = 'drop'
        and created_at >= date_trunc('day', now() at time zone them.tz) at time zone them.tz) >= 4 then
      continue;
    end if;
    select array_agg(t.title order by t.created_at), count(*) filter (where t.owner = them.side),
      jsonb_agg(t.id)
      into titles, mine, ids
    from new_rows e join tasks t on t.id = e.task_id
    where e.kind = 'drop' and e.actor = dropper.id;
    if titles is null then continue; end if;
    insert into push_outbox (member, kind, title, body, data, send_after)
    values (them.id, 'drop',
      dropper.name || ' dropped ' || case when cardinality(titles) = 1 then 'something' else cardinality(titles) || ' things' end,
      array_to_string(titles, ', ') || case
        when mine = 0 then '.'
        when mine = cardinality(titles) then '. Dealt to you.'
        else '. ' || mine || ' dealt to you.' end,
      jsonb_build_object('task_ids', ids), public.push_ready_at(them));
  end loop;
  perform public.push_flush();
  return null;
end $$;
create trigger drop_push after insert on public.task_events
  referencing new table as new_rows for each statement execute function public.notify_drop();

-- A finished job tells the partner right away, so a heart can go out any day, not only Sunday.
create function public.notify_done() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  doer members;
  them members;
begin
  if new.status <> 'done' or old.status = 'done' or new.done_by is null then return new; end if;
  select * into doer from members where id = new.done_by;
  select * into them from members where couple_id = new.couple_id and id <> new.done_by;
  if them.id is null then return new; end if;
  if (select count(*) from push_outbox where member = them.id and kind = 'done'
      and created_at >= date_trunc('day', now() at time zone them.tz) at time zone them.tz) >= 6 then
    return new;
  end if;
  insert into push_outbox (member, kind, title, body, data, send_after)
  values (them.id, 'done', doer.name || ' finished ' || public.mid(new.title),
    'Send a heart if it made your day lighter.', jsonb_build_object('task_id', new.id), public.push_ready_at(them));
  perform public.push_flush();
  return new;
end $$;
create trigger done_push after update of status on public.tasks for each row execute function public.notify_done();

-- New hand pushes skip cards the partner's drop push already announced.
create or replace function public.push_tick() returns int
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

    if extract(hour from l) in (9, 18)
      and (select count(*) from push_outbox where member = m.id and kind = 'hand' and created_at >= day_start) < 2
    then
      select max(created_at) into last_hand from push_outbox where member = m.id and kind = 'hand';
      if last_hand is null or last_hand < now() - interval '6 hours' then
        select array_agg(title order by created_at) into fresh from tasks t
        where t.couple_id = m.couple_id and t.status = 'deal' and t.owner = m.side
          and t.updated_at > coalesce(last_hand, '-infinity')
          and (t.dropped_by is distinct from m.id or t.traded)
          and not exists (select 1 from push_outbox o where o.member = m.id and o.kind = 'drop'
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

  delete from push_tokens where token in (
    select d -> 'details' ->> 'expoPushToken'
    from (select case when content like '%DeviceNotRegistered%' then content::jsonb -> 'data' end as data
          from net._http_response where created > now() - interval '1 hour') r,
      jsonb_array_elements(case when jsonb_typeof(r.data) = 'array' then r.data else '[]' end) d
    where d -> 'details' ->> 'error' = 'DeviceNotRegistered'
  );

  return public.push_flush();
end $$;

revoke execute on function public.notify_drop, public.notify_done, public.push_tick from anon, authenticated, public;
revoke execute on function public.ack_thanks from anon;
