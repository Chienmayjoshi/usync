-- usync M4: one line updates and the waiting state, thanks, Sunday Sync, account deletion.

-- One heart per person per job.
alter table public.thanks add constraint thanks_once unique (task_id, from_member);

-- Add a one line update to a card's story. External delays move it to Waiting, which
-- takes it off the deck and never counts as a slip.
create function public.add_update(task uuid, note text, waiting boolean) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  me members;
begin
  select * into me from members where id = auth.uid();
  select * into t from tasks where id = task and couple_id = me.couple_id for update;
  if t.id is null then raise exception 'Card not found.'; end if;
  if t.status = 'done' then raise exception 'This one is already done.'; end if;
  if length(trim(note)) = 0 then raise exception 'Say what changed in a few words.'; end if;
  if waiting then
    update tasks set status = 'waiting', waiting_note = trim(note), updated_at = now() where id = t.id returning * into t;
  elsif t.status = 'waiting' then
    update tasks set status = 'active', waiting_note = null, sort_at = now(), updated_at = now() where id = t.id returning * into t;
  end if;
  insert into task_events (task_id, couple_id, actor, kind, text)
    values (t.id, t.couple_id, me.id, case when waiting then 'waiting' else 'update' end, me.name || ': ' || trim(note));
  return t;
end $$;

-- They showed up / back on track: a waiting card returns to its owner's deck.
create function public.resume_task(task uuid) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  me members;
begin
  select * into me from members where id = auth.uid();
  update tasks set status = 'active', waiting_note = null, sort_at = now(), updated_at = now()
    where id = task and couple_id = me.couple_id and status = 'waiting' returning * into t;
  if t.id is null then raise exception 'That card is not waiting.'; end if;
  insert into task_events (task_id, couple_id, actor, kind, text) values (t.id, t.couple_id, me.id, 'resume', 'Back on track');
  return t;
end $$;

-- Sunday Sync: one appreciation each per week, sealed until both have written
-- (or the week is over, so effort is never wasted).
create table public.sync_entries (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  member uuid not null references public.members (id) on delete cascade,
  week_start date not null,
  appreciation text not null,
  created_at timestamptz not null default now(),
  unique (member, week_start)
);

create function public.sync_revealed(cid uuid, wk date) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from sync_entries where couple_id = cid and week_start = wk) >= 2
      or now() >= wk + interval '7 days'
$$;

alter table public.sync_entries enable row level security;
create policy "mine, or both once revealed" on public.sync_entries for select
  using (member = auth.uid() or (couple_id = public.my_couple() and public.sync_revealed(couple_id, week_start)));
create policy "write mine" on public.sync_entries for insert with check (member = auth.uid() and couple_id = public.my_couple());
create policy "edit mine" on public.sync_entries for update using (member = auth.uid()) with check (member = auth.uid() and couple_id = public.my_couple());

-- Full account deletion (store requirement). The partner keeps the shared cards.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_couple();
begin
  delete from auth.users where id = auth.uid();
  if cid is not null and not exists (select 1 from members where couple_id = cid) then
    delete from couples where id = cid;
  end if;
end $$;

revoke execute on function public.add_update, public.resume_task, public.delete_my_account from anon;
alter publication supabase_realtime add table public.sync_entries;
