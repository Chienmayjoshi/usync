delete from auth.users where email in ('test-r@usync.dev', 'test-m@usync.dev');
delete from public.couples c where not exists (select 1 from public.members m where m.couple_id = c.id);
select (select count(*) from auth.users) users, (select count(*) from public.couples) couples, (select count(*) from public.tasks) tasks;
