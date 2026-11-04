-- usync: the Table flow from the redesign.
-- Nothing is dealt automatically any more. A new card goes on the shared Table or straight onto
-- my deck. From the Table I take it, ask my partner to take it, or ask to do it together; my
-- partner answers the request from their deck. Either of us can ask for a card on the other's
-- deck. A surprise stays invisible to the partner until it is done. Any card can be deleted.
-- Old moves keep working so installed builds are not broken by this migration.

alter table public.tasks
  add column request text check (request in ('take', 'together', 'give')),
  add column requested_by uuid references public.members (id) on delete set null,
  add column surprise boolean not null default false;

-- A surprise is the dropper's secret until it is done.
create or replace function public.can_see_task(t public.tasks) returns boolean
language sql stable as $$
  select t.couple_id = public.my_couple() and (not t.surprise or t.dropped_by = auth.uid() or t.status = 'done')
$$;

drop policy "couple tasks" on public.tasks;
create policy "couple tasks read" on public.tasks for select using (public.can_see_task(tasks));
create policy "couple tasks add" on public.tasks for insert with check (couple_id = public.my_couple());
create policy "couple tasks edit" on public.tasks for update using (public.can_see_task(tasks)) with check (couple_id = public.my_couple());
create policy "couple tasks delete" on public.tasks for delete using (public.can_see_task(tasks));

drop policy "couple events read" on public.task_events;
create policy "couple events read" on public.task_events for select
  using (couple_id = public.my_couple() and exists (select 1 from public.tasks t where t.id = task_id and public.can_see_task(t)));

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('thanks', 'sync', 'hand', 'nudge', 'drop', 'done', 'request'));

-- Deck moves. New:
--   ask       from the Table (or my own card): my partner is asked to take it
--   together  from the Table: my partner is asked to do it with me (pending until they say yes)
--   ask_for   on my partner's card: I ask them to give it to me
--   accept    answer yes to a request aimed at me
--   decline   answer no: asked and together cards go back to the Table, a give request is dropped
-- grab (take from the Table) now also works on a card that is a request aimed at me.
create or replace function public.deck_move(task uuid, move text) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  me members;
  other text;
  note text;
  mine boolean;
  for_me boolean;
begin
  select * into me from members where id = auth.uid();
  select * into t from tasks where id = task and couple_id = me.couple_id for update;
  if t.id is null or (t.surprise and t.dropped_by <> me.id and t.status <> 'done') then raise exception 'Card not found.'; end if;
  other := case me.side when 'a' then 'b' else 'a' end;
  mine := t.owner = me.side;
  for_me := t.request is not null and t.requested_by is distinct from me.id;

  if move = 'ask' and t.status in ('deal', 'active') and (t.owner = 'table' or mine) then
    t.owner := other; t.status := 'deal'; t.request := 'take'; t.requested_by := me.id; t.traded := true;
    note := me.name || ' asked their partner to take it';
  elsif move = 'together' and t.status = 'deal' and t.owner = 'table' then
    t.owner := 'together'; t.request := 'together'; t.requested_by := me.id;
    note := me.name || ' asked to do it together';
  elsif move = 'together' and t.status = 'deal' then
    -- Older builds: a dealt card shared straight away.
    t.owner := 'together'; t.status := 'active'; t.request := null; t.requested_by := null; note := 'Doing it together';
  elsif move = 'ask_for' and t.status = 'active' and t.owner = other and t.request is null then
    t.request := 'give'; t.requested_by := me.id; note := me.name || ' asked for it';
  elsif move = 'accept' and for_me and t.request = 'take' and mine then
    t.status := 'active'; t.request := null; t.requested_by := null; note := me.name || ' took it';
  elsif move = 'accept' and for_me and t.request = 'together' then
    t.status := 'active'; t.request := null; t.requested_by := null; note := 'Doing it together';
  elsif move = 'accept' and for_me and t.request = 'give' and mine then
    t.owner := other; t.request := null; t.requested_by := null; note := me.name || ' gave it away';
  elsif move = 'decline' and for_me and t.request in ('take', 'together') then
    t.owner := 'table'; t.status := 'deal'; t.request := null; t.requested_by := null; note := me.name || ' put it back on the table';
  elsif move = 'decline' and for_me and t.request = 'give' then
    t.request := null; t.requested_by := null; note := me.name || ' kept it';
  elsif move = 'take' and t.status = 'deal' then
    t.owner := me.side; t.status := 'active'; t.request := null; t.requested_by := null; note := me.name || ' took it';
  elsif move = 'trade' and (t.status = 'deal' or (t.status = 'active' and mine)) then
    if not t.traded then
      t.owner := other; t.traded := true; t.status := 'deal'; note := me.name || ' traded it';
    else
      t.owner := 'table'; t.status := 'deal'; note := me.name || ' passed it to the open table';
    end if;
    t.request := null; t.requested_by := null;
  elsif move = 'table' and t.owner <> 'table' and (t.status = 'deal' or (t.status = 'active' and (mine or t.owner = 'together'))) then
    t.owner := 'table'; t.status := 'deal'; t.request := null; t.requested_by := null; note := me.name || ' put it back on the table';
  elsif move = 'grab' and t.status <> 'done' and (t.owner = 'table' or (t.request = 'take' and mine)) then
    t.owner := me.side; t.status := 'active'; t.request := null; t.requested_by := null; note := me.name || ' took it from the table';
  elsif move = 'later' and t.status in ('deal', 'active') then
    note := case when t.status = 'deal' then 'Skipped for now' else 'Moved to later' end;
  elsif move = 'done' and t.status in ('deal', 'active', 'waiting') then
    if t.status = 'deal' and t.owner <> 'together' then t.owner := me.side; end if;
    t.status := 'done'; t.done_by := me.id; t.done_at := now(); t.request := null; t.requested_by := null; note := 'Done by ' || me.name;
  else
    raise exception 'That move is not allowed for this card.';
  end if;

  if move in ('take', 'together', 'later', 'trade', 'table', 'ask', 'grab', 'accept', 'decline') then t.sort_at := now(); end if;
  update tasks set owner = t.owner, status = t.status, traded = t.traded, done_by = t.done_by, done_at = t.done_at,
    request = t.request, requested_by = t.requested_by, sort_at = t.sort_at, updated_at = now()
    where id = t.id returning * into t;
  insert into task_events (task_id, couple_id, actor, kind, text) values (t.id, t.couple_id, me.id, move, note);
  return t;
end $$;

-- Delete a card for good (hold, then Delete). Either of us, as long as we can see it.
create function public.delete_task(task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = task and couple_id = public.my_couple();
  if t.id is null or (t.surprise and t.dropped_by <> auth.uid() and t.status <> 'done') then raise exception 'Card not found.'; end if;
  delete from tasks where id = t.id;
end $$;
revoke execute on function public.delete_task from anon;

-- A request reaches the partner right away (or when their quiet hours end).
create function public.notify_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  asker members;
  them members;
begin
  if new.request is null or new.request is not distinct from old.request then return null; end if;
  select * into asker from members where id = new.requested_by;
  select * into them from members where couple_id = new.couple_id and id <> asker.id;
  if them.id is null then return null; end if;
  insert into push_outbox (member, kind, title, body, data, send_after) values (them.id, 'request',
    case new.request
      when 'take' then asker.name || ' asked you to take this'
      when 'together' then asker.name || ' wants to do it together'
      else asker.name || ' asked for your card' end,
    new.title,
    jsonb_build_object('task_ids', jsonb_build_array(new.id), 'task_id', new.id, 'request', new.request),
    public.push_ready_at(them));
  perform public.push_flush();
  return null;
end $$;
revoke execute on function public.notify_request from anon, authenticated, public;
create trigger tasks_request after update of request on public.tasks
  for each row execute function public.notify_request();

-- New drops: announce what lands on the Table (never surprises, never cards kept for myself).
create or replace function public.notify_drop() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dropper members;
  them members;
  titles text[];
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
    select array_agg(t.title order by t.created_at), jsonb_agg(t.id) into titles, ids
    from new_rows e join tasks t on t.id = e.task_id
    where e.kind = 'drop' and e.actor = dropper.id and t.owner is distinct from dropper.side and not t.surprise;
    if titles is null then continue; end if;
    insert into push_outbox (member, kind, title, body, data, send_after)
    values (them.id, 'drop',
      dropper.name || ' put ' || case when cardinality(titles) = 1 then 'something' else cardinality(titles) || ' things' end || ' on the table',
      array_to_string(titles, ', ') || '.',
      jsonb_build_object('task_ids', ids), public.push_ready_at(them));
  end loop;
  perform public.push_flush();
  return null;
end $$;
revoke execute on function public.notify_drop from anon, authenticated, public;

-- Hand pushes: requests and surprises have their own path (or none).
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
revoke execute on function public.push_tick from anon, authenticated, public;

-- Undo within 5 seconds, now including the request state.
create function public.deck_restore_v2(task uuid, prev_owner text, prev_status text, prev_traded boolean, prev_sort timestamptz,
  prev_request text, prev_requested_by uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update tasks set owner = prev_owner, status = prev_status, traded = prev_traded, sort_at = prev_sort,
    request = prev_request, requested_by = prev_requested_by,
    done_by = case when prev_status = 'done' then done_by end, done_at = case when prev_status = 'done' then done_at end,
    updated_at = now()
  where id = task and couple_id = public.my_couple();
  insert into task_events (task_id, couple_id, actor, kind, text)
    select task, public.my_couple(), auth.uid(), 'undo', 'Undone' where found;
end $$;
revoke execute on function public.deck_restore_v2 from anon;
