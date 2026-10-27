-- M3 server check: pair the two test accounts, give Meera a phone, then exercise every push path.
-- Run after test-users.sql; cleanup.sql removes everything. Expo answers the fake token with an
-- error ticket, which proves the request left the database and reached Expo.
do $$
declare r uuid; m uuid; cid uuid;
begin
  select id into r from auth.users where email = 'test-r@usync.dev';
  select id into m from auth.users where email = 'test-m@usync.dev';
  insert into couples (invite_code) values ('PUSHT1') returning id into cid;
  insert into members (id, couple_id, side, name) values (r, cid, 'a', 'Rahul'), (m, cid, 'b', 'Meera');
  -- A clock where Meera is in her 18:00 slot, whatever the real time is.
  update members set tz = 'Etc/GMT' || to_char(extract(hour from now() at time zone 'UTC')::int - 18, 'FMSG99') where id = m;
  insert into push_tokens (token, member, platform) values ('ExponentPushToken[usync-fake-meera]', m, 'ios');
  insert into tasks (couple_id, title, raw, bucket, effort, owner, status, dropped_by) values
    (cid, 'Call the electrician', 'x', 'Home', 'quick', 'b', 'deal', r),
    (cid, 'Renew car insurance', 'x', 'Admin', 'quick', 'b', 'deal', r),
    (cid, 'Book Goa tickets', 'x', 'Us', 'quick', 'b', 'deal', r),
    (cid, 'My own drop', 'x', 'Home', 'quick', 'b', 'deal', m);
  insert into tasks (couple_id, title, raw, bucket, effort, owner, status, sort_at, dropped_by) values
    (cid, 'Return the Amazon kettle', 'x', 'Errands', 'quick', 'b', 'active', now() - interval '4 days', r);
  insert into tasks (couple_id, title, raw, bucket, effort, owner, status, done_by, done_at) values
    (cid, 'Fix the geyser', 'x', 'Home', 'quick', 'b', 'done', m, now());
  -- Rahul thanks Meera.
  insert into thanks (couple_id, task_id, from_member) select cid, id, r from tasks where title = 'Fix the geyser' and couple_id = cid;
end $$;
select public.push_tick() as sent_by_tick;
select public.push_tick() as second_tick_sends_nothing;
create temp table sent_first as select kind, title, body, sent_at is not null as sent from push_outbox o join members mm on mm.id = o.member where mm.name = 'Meera' order by o.id;
-- Next tick: Expo's DeviceNotRegistered answer for the fake token removes it.
select public.push_tick();
create temp table res as select (select count(*) from push_tokens where token like '%usync-fake%') as dead_tokens_left;
-- Quiet hours: put Meera at 23:00 and have Rahul thank her again.
update members set tz = 'Etc/GMT' || to_char(extract(hour from now() at time zone 'UTC')::int - 23, 'FMSG99') where name = 'Meera';
insert into thanks (couple_id, task_id, from_member)
  select t.couple_id, t.id, r.id from tasks t join members r on r.name = 'Rahul' and r.couple_id = t.couple_id where t.title = 'Return the Amazon kettle';
insert into res select null;
-- RLS: Rahul sees only his own outbox rows (none), Meera sees hers.
create temp table ids as select email, id from auth.users;
grant select on ids to authenticated;
create temp table rahul(n int); create temp table meera(n int); grant all on rahul, meera to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from ids where email='test-r@usync.dev'), 'role','authenticated')::text, true);
insert into rahul select count(*) from push_outbox;
select set_config('request.jwt.claims', json_build_object('sub', (select id from ids where email='test-m@usync.dev'), 'role','authenticated')::text, true);
insert into meera select count(*) from push_outbox;
reset role;
select (select json_agg(sent_first) from sent_first) first_round, (select dead_tokens_left from res limit 1) dead_tokens_left, (select n from rahul) rahul_sees, (select n from meera) meera_sees,
  (select (send_after at time zone m.tz)::text from push_outbox o join members m on m.id=o.member where o.kind='thanks' and o.sent_at is null) held_until_local;
