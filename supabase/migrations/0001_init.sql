-- usync M1: couples, members, the shared deck and its job stories.
-- Every row belongs to one couple; RLS lets only that couple's two members see it.

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid references public.couples (id) on delete set null,
  -- 'a' started the space, 'b' joined it. Owners on tasks refer to these sides.
  side text check (side in ('a', 'b')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, side)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null,
  raw text not null,
  bucket text not null check (bucket in ('Home', 'Admin', 'Errands', 'Family', 'Us')),
  effort text not null,
  weight real not null default 1,
  when_text text not null default 'this week',
  detail text not null default '',
  owner text not null check (owner in ('a', 'b', 'together', 'table')),
  status text not null default 'deal' check (status in ('deal', 'active', 'waiting', 'done')),
  traded boolean not null default false,
  waiting_note text,
  dropped_by uuid references public.members (id) on delete set null,
  done_by uuid references public.members (id) on delete set null,
  done_at timestamptz,
  -- Deck order: moved to "now" when a card goes to the back of the pile.
  sort_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_couple_idx on public.tasks (couple_id, sort_at);

create table public.task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  actor uuid references public.members (id) on delete set null,
  kind text not null,
  text text not null,
  at timestamptz not null default now()
);
create index task_events_task_idx on public.task_events (task_id, at);

create table public.thanks (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  from_member uuid references public.members (id) on delete set null,
  at timestamptz not null default now()
);

-- The caller's couple, readable inside policies without recursion.
create function public.my_couple() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from public.members where id = auth.uid()
$$;

create function public.my_side() returns text
language sql stable security definer set search_path = public as $$
  select side from public.members where id = auth.uid()
$$;

alter table public.couples enable row level security;
alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.thanks enable row level security;

create policy "own couple" on public.couples for select using (id = public.my_couple());

create policy "me and my partner" on public.members for select using (id = auth.uid() or couple_id = public.my_couple());
create policy "create myself" on public.members for insert with check (id = auth.uid() and couple_id is null);
-- Couple and side change only through create_space / join_space / leave_space.
create policy "rename myself" on public.members for update using (id = auth.uid())
  with check (id = auth.uid() and couple_id is not distinct from public.my_couple() and side is not distinct from public.my_side());

create policy "couple tasks" on public.tasks for all using (couple_id = public.my_couple()) with check (couple_id = public.my_couple());
create policy "couple events read" on public.task_events for select using (couple_id = public.my_couple());
create policy "couple events add" on public.task_events for insert with check (couple_id = public.my_couple() and actor = auth.uid());
create policy "couple thanks read" on public.thanks for select using (couple_id = public.my_couple());
create policy "couple thanks add" on public.thanks for insert with check (couple_id = public.my_couple() and from_member = auth.uid());

-- Start a space: creates the couple and an invite code, makes the caller side 'a'.
create function public.create_space() returns text
language plpgsql security definer set search_path = public as $$
declare
  code text;
  cid uuid;
begin
  if public.my_couple() is not null then
    select invite_code into code from couples where id = public.my_couple();
    return code;
  end if;
  loop
    -- No 0/O/1/I so the code survives being read out over the phone.
    code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from couples where invite_code = code);
  end loop;
  insert into couples (invite_code) values (code) returning id into cid;
  update members set couple_id = cid, side = 'a' where id = auth.uid();
  return code;
end $$;

-- Join with the partner's code. A space holds exactly two people.
create function public.join_space(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  taken int;
begin
  select id into cid from couples where invite_code = upper(trim(code));
  if cid is null then raise exception 'That code does not match a space.'; end if;
  if public.my_couple() = cid then return cid; end if;
  if public.my_couple() is not null then raise exception 'You are already in a space. Leave it first.'; end if;
  select count(*) into taken from members where couple_id = cid;
  if taken >= 2 then raise exception 'That space already has two people.'; end if;
  update members set couple_id = cid, side = 'b' where id = auth.uid();
  return cid;
end $$;

-- Deck moves, with the core loop rules enforced here so both phones agree.
create function public.deck_move(task uuid, move text) returns public.tasks
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
  other := case me.side when 'a' then 'b' else 'a' end;

  if move = 'take' and t.status = 'deal' then
    t.owner := me.side; t.status := 'active'; note := me.name || ' took it';
  elsif move = 'together' and t.status = 'deal' then
    t.owner := 'together'; t.status := 'active'; note := 'Doing it together';
  elsif move = 'trade' and t.status = 'deal' then
    -- One trade per card. After that a pass sends it to the open table, never back and forth.
    if not t.traded then
      t.owner := other; t.traded := true; note := me.name || ' traded it';
    else
      t.owner := 'table'; note := me.name || ' passed it to the open table';
    end if;
  elsif move = 'grab' and t.owner = 'table' then
    t.owner := me.side; t.status := 'active'; note := me.name || ' grabbed it from the table';
  elsif move = 'later' and t.status = 'active' then
    note := 'Moved to later';
  elsif move = 'done' and t.status in ('active', 'waiting') then
    t.status := 'done'; t.done_by := me.id; t.done_at := now(); note := 'Done by ' || me.name;
  else
    raise exception 'That move is not allowed for this card.';
  end if;

  -- Taken, shared or postponed cards go to the back so the next card comes up.
  if move in ('take', 'together', 'later') then t.sort_at := now(); end if;
  update tasks set owner = t.owner, status = t.status, traded = t.traded, done_by = t.done_by, done_at = t.done_at,
    sort_at = t.sort_at, updated_at = now() where id = t.id returning * into t;
  insert into task_events (task_id, couple_id, actor, kind, text) values (t.id, t.couple_id, me.id, move, note);
  return t;
end $$;

-- Undo within 5 seconds: put the card back exactly as it was.
create function public.deck_restore(task uuid, prev_owner text, prev_status text, prev_traded boolean, prev_sort timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update tasks set owner = prev_owner, status = prev_status, traded = prev_traded, sort_at = prev_sort,
    done_by = case when prev_status = 'done' then done_by end, done_at = case when prev_status = 'done' then done_at end,
    updated_at = now()
  where id = task and couple_id = public.my_couple();
  insert into task_events (task_id, couple_id, actor, kind, text)
    select task, public.my_couple(), auth.uid(), 'undo', 'Undone' where found;
end $$;

-- Leave the space. The partner keeps the shared history (read only rules come in M4).
create function public.leave_space() returns void
language sql security definer set search_path = public as $$
  update members set couple_id = null, side = null where id = auth.uid();
$$;

revoke execute on function public.create_space, public.join_space, public.deck_move, public.deck_restore, public.leave_space from anon;

alter publication supabase_realtime add table public.tasks, public.members, public.task_events, public.thanks;
