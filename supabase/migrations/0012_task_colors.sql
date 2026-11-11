-- Every task gets its own colour, kept for life, so it reads as the same task on the Table, in
-- My Deck and on the Partner tab. A new task takes the colour least used among the couple's open
-- tasks; ties go by a hash of its id so neighbours spread out.

alter table public.tasks
  add column if not exists color text check (color in ('rose', 'lagoon', 'ember', 'violet', 'lime', 'sky', 'gold'));

create or replace function public.pick_task_color(couple uuid, seed uuid) returns text
language sql stable security definer set search_path = public as $$
  with palette(color, i) as (
    select * from unnest(array['rose', 'lagoon', 'ember', 'violet', 'lime', 'sky', 'gold']) with ordinality
  ), used as (
    select color, count(*) as n from tasks
    where couple_id = couple and status <> 'done' and color is not null and id <> seed
    group by color
  )
  select p.color from palette p left join used u using (color)
  order by coalesce(u.n, 0), (p.i + abs(hashtext(seed::text))) % 7
  limit 1
$$;
revoke execute on function public.pick_task_color from anon, authenticated, public;

create or replace function public.task_color_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.color is null then new.color := public.pick_task_color(new.couple_id, new.id); end if;
  return new;
end $$;
revoke execute on function public.task_color_default from anon, authenticated, public;

drop trigger if exists tasks_color on public.tasks;
create trigger tasks_color before insert on public.tasks
  for each row execute function public.task_color_default();

-- The tasks there already, oldest first, so they come out as different from each other as they can.
do $$
declare r record;
begin
  for r in select id, couple_id from public.tasks where color is null order by created_at loop
    update public.tasks set color = public.pick_task_color(r.couple_id, r.id) where id = r.id;
  end loop;
end $$;
