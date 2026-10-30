-- usync: dropping a card for myself, and changing who it is for afterwards.
-- The app now lets the dropper choose (fair split, just me, together) when dropping. Cards still
-- undecided can be reassigned by the person who dropped them, for free (no trade is spent).
-- Once the partner has taken a card it is theirs: the dropper can no longer move it.

create function public.reassign_task(task uuid, to_who text) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  me members;
  other text;
  note text;
begin
  select * into me from members where id = auth.uid();
  select * into t from tasks where id = task and couple_id = me.couple_id for update;
  if t.id is null then raise exception 'Card not found.'; end if;
  if t.dropped_by is distinct from me.id then raise exception 'Only the person who dropped a card can change who it is for.'; end if;
  if t.status <> 'deal' then raise exception 'That card has already been taken. Trade it from your deck instead.'; end if;
  other := case me.side when 'a' then 'b' else 'a' end;

  if to_who = 'me' then
    t.owner := me.side; t.status := 'active'; note := me.name || ' kept it';
  elsif to_who = 'partner' then
    t.owner := other; t.status := 'deal'; note := me.name || ' gave it to their partner';
  elsif to_who = 'together' then
    t.owner := 'together'; t.status := 'deal'; note := me.name || ' made it a shared job';
  else
    raise exception 'Choose me, partner or together.';
  end if;

  update tasks set owner = t.owner, status = t.status, sort_at = now(), updated_at = now()
    where id = t.id returning * into t;
  insert into task_events (task_id, couple_id, actor, kind, text) values (t.id, t.couple_id, me.id, 'reassign', note);
  return t;
end $$;
revoke execute on function public.reassign_task from anon;

-- A card dropped for myself needs no push to my partner: only cards that land on them or on the
-- table, or are shared, are announced.
create or replace function public.notify_drop() returns trigger
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
    where e.kind = 'drop' and e.actor = dropper.id and t.owner is distinct from dropper.side;
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
revoke execute on function public.notify_drop from anon, authenticated, public;
