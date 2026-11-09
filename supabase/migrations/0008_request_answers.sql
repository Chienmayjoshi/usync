-- Answers to requests reach the asker.
--
-- When I ask my partner to do a Table card together (or to take it), they answer from their deck.
-- A yes puts it on both our decks, a no puts it back on the Table; either way I now get told,
-- with a push (or a banner when the app is open). Withdrawing my own ask, or undoing, says nothing.

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('thanks', 'sync', 'hand', 'nudge', 'drop', 'done', 'request', 'answer'));

create or replace function public.notify_answer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  asker members;
  them members;
  yes boolean;
  who text;
begin
  if coalesce(old.request, '') not in ('take', 'together') or new.request is not null or old.requested_by is null then
    return null;
  end if;
  -- Only an answer from the other one counts, not the asker taking their own ask back.
  if auth.uid() is not distinct from old.requested_by then return null; end if;
  if new.owner = 'table' and new.status = 'deal' then yes := false;
  elsif new.status = 'active' and ((old.request = 'together' and new.owner = 'together') or old.request = 'take') then yes := true;
  else return null; end if;

  select * into asker from members where id = old.requested_by;
  select * into them from members where couple_id = new.couple_id and id <> old.requested_by;
  if asker.id is null then return null; end if;
  who := coalesce(them.name, 'Your partner');

  insert into push_outbox (member, kind, title, body, data, send_after) values (asker.id, 'answer',
    case
      when not yes then who || ' can''t take this one right now'
      when old.request = 'together' then who || ' is in. Doing it together 🤝'
      else who || ' took it' end,
    case
      when not yes then new.title || ' is back on the table.'
      when old.request = 'together' then new.title || ' is on both your decks.'
      else new.title end,
    jsonb_build_object('kind', 'answer', 'task_id', new.id, 'request', old.request, 'yes', yes),
    public.push_ready_at(asker));
  perform public.push_flush();
  return null;
end $$;
revoke execute on function public.notify_answer from anon, authenticated, public;

drop trigger if exists tasks_answer on public.tasks;
create trigger tasks_answer after update of request on public.tasks
  for each row execute function public.notify_answer();
