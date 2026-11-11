-- Reactions in place of the single heart.
--
-- Appreciating a finished card can say more than a heart: a hug, a laugh, a wow, happy tears.
-- Still one per card per person (thanks_once from 0002); changing it updates the row, and if the
-- partner has not opened it yet they see the new one. The push says which it was.

alter table public.thanks
  add column reaction text not null default 'heart' check (reaction in ('heart', 'care', 'laugh', 'wow', 'tears'));

-- What the partner reads: "{name} sent you a hug 🤗".
create or replace function public.reaction_line(r text, who text) returns text
language sql immutable as $$
  select who || case r
    when 'care' then ' sent you a hug 🤗'
    when 'laugh' then ' laughed at this 😂'
    when 'wow' then ' is impressed 😮'
    when 'tears' then ' is moved 🥹'
    else ' sent you a heart ❤️' end
$$;

create or replace function public.notify_thanks() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sender members;
  them members;
  what text;
begin
  if tg_op = 'UPDATE' and new.reaction is not distinct from old.reaction then return new; end if;
  select * into sender from members where id = new.from_member;
  select * into them from members where couple_id = new.couple_id and id <> new.from_member;
  if them.id is null then return new; end if;
  select title into what from tasks where id = new.task_id;
  insert into push_outbox (member, kind, title, body, data, send_after)
  values (them.id, 'thanks', public.reaction_line(new.reaction, coalesce(sender.name, 'Your partner')),
    coalesce('“' || nullif(trim(new.note), '') || '”', 'for “' || public.mid(what) || '”', 'for something you did'),
    jsonb_build_object('task_id', new.task_id, 'thanks_id', new.id, 'reaction', new.reaction), public.push_ready_at(them));
  perform public.push_flush();
  return new;
end $$;
revoke execute on function public.notify_thanks from anon, authenticated, public;

drop trigger if exists thanks_push_change on public.thanks;
create trigger thanks_push_change after update of reaction on public.thanks
  for each row execute function public.notify_thanks();

-- React to a finished card: the first time adds it, after that changes it (and its note, if given).
create or replace function public.react(task uuid, reaction text, note text default null) returns public.thanks
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  t tasks;
  r thanks;
begin
  select * into t from tasks where id = task and couple_id = public.my_couple();
  if t.id is null then raise exception 'Card not found.'; end if;
  insert into thanks (couple_id, task_id, from_member, note, reaction)
  values (t.couple_id, t.id, auth.uid(), nullif(trim(note), ''), reaction)
  on conflict (task_id, from_member) do update
    set reaction = excluded.reaction,
        note = coalesce(excluded.note, thanks.note),
        seen_at = case when thanks.reaction is distinct from excluded.reaction then null else thanks.seen_at end
  returning * into r;
  return r;
end $$;
revoke execute on function public.react from anon;

-- Undo a reaction the partner has not opened yet.
create or replace function public.retract_reaction(task uuid) returns void
language sql security definer set search_path = public as $$
  delete from thanks where task_id = task and from_member = auth.uid() and seen_at is null;
$$;
revoke execute on function public.retract_reaction from anon;
