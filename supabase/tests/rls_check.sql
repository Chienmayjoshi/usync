-- Two couples, four people. Everything runs inside a transaction that is rolled back.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'r@test.dev'), ('00000000-0000-0000-0000-00000000000b', 'm@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'x@test.dev'), ('00000000-0000-0000-0000-00000000000d', 'y@test.dev');

create temp table out (step text, ok boolean, detail text);
grant all on out to authenticated;

set local role authenticated;
-- Rahul starts a space.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into members (id, name) values (auth.uid(), 'Rahul');
create temp table code as select create_space() as c;
create temp table rc as select my_couple() as id;
-- Meera joins with the code.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
insert into members (id, name) values (auth.uid(), 'Meera');
select join_space((select c from code));
insert into tasks (couple_id, title, raw, bucket, effort, owner) values (my_couple(), 'Book electrician', 'book electrician', 'Home', '15 min call', 'a');
-- A stranger cannot join a full space or see its cards.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
insert into members (id, name) values (auth.uid(), 'X');
insert into out select 'stranger sees no tasks', count(*) = 0, count(*)::text from tasks;
insert into out select 'stranger sees no members but self', count(*) = 1, count(*)::text from members;
do $$ begin perform join_space((select c from code)); insert into out values ('third person blocked', false, 'joined'); exception when others then insert into out values ('third person blocked', true, sqlerrm); end $$;
select create_space();
do $$ begin insert into tasks (couple_id, title, raw, bucket, effort, owner) select id, 'sneak', 'sneak', 'Home', 'x', 'a' from rc; insert into out values ('stranger cannot insert into another couple', false, 'inserted'); exception when others then insert into out values ('stranger cannot insert into another couple', true, sqlerrm); end $$;
do $$ begin update members set couple_id = (select couple_id from members where name='Rahul') where id = auth.uid(); insert into out select 'cannot move self into a couple', not exists (select 1 from members where id = auth.uid() and couple_id is distinct from my_couple()), 'update ran'; exception when others then insert into out values ('cannot move self into a couple', true, sqlerrm); end $$;
-- Rahul sees the card and the trade rule holds.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into out select 'partner sees shared card', count(*) = 1, count(*)::text from tasks;
insert into out select 'first trade goes to partner', owner = 'b' and traded, owner from deck_move((select id from tasks limit 1), 'trade');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
insert into out select 'second pass goes to table', owner = 'table', owner from deck_move((select id from tasks limit 1), 'trade');
insert into out select 'grab from table', owner = 'b' and status = 'active', owner || '/' || status from deck_move((select id from tasks limit 1), 'grab');
insert into out select 'done', status = 'done', status from deck_move((select id from tasks limit 1), 'done');
insert into out select 'story has 4 events', count(*) = 4, string_agg(text, ' | ' order by at, id) from task_events;
reset role;
select step, ok, detail from out;
rollback;
