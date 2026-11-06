-- Partner mascot nudges.
--
-- Each member builds a mascot of themselves (an Open Peeps recipe) and picks its voice. Cards
-- that sit ignored are nudged in the partner's name, in Hinglish, a little firmer the longer they
-- wait: gentle (3+ days), cheeky (6+), firm (10+), never past what the receiver allows.
-- Nudges are private: they go to the receiver's outbox only.

alter table public.members
  add column mascot jsonb check (mascot is null or pg_column_size(mascot) < 2048),
  add column voice text not null default 'neutral' check (voice in ('he', 'she', 'neutral')),
  add column nudge_max smallint not null default 2 check (nudge_max between 1 and 3);

-- How firm a nudge is for a card that has sat since `since`: 0 none, 1 gentle, 2 cheeky, 3 firm.
create or replace function public.nudge_level(since timestamptz, cap int) returns int
language sql stable as $$
  select least(cap, case
    when now() - since >= interval '10 days' then 3
    when now() - since >= interval '6 days' then 2
    when now() - since >= interval '3 days' then 1
    else 0 end)
$$;

-- The lines. %s is the task title; {he|she|neutral} picks the mascot's voice. Mirrored in the
-- app (src/features/mascot/lines.ts) so a card shows what its push said. Keep both in step.
create or replace function public.nudge_line(kind text, level int, seed int, voice text) returns text
language plpgsql immutable as $$
declare
  lines text[];
  line text;
  pick int := case voice when 'he' then 1 when 'she' then 2 else 3 end;
  m text[];
begin
  lines := case kind || level
    when 'mine1' then array[
      '%s yaad hai na? Aaj thoda time nikaal lo 🙂',
      'Bas yaad dila {raha|rahi|rahe} {hoon|hoon|hain}: %s abhi baaki hai.',
      '%s chhota sa kaam hai, aaj ho jaaye?',
      'Chai ke baad %s? Deal? ☕',
      '%s tumhara wait kar raha hai, koi jaldi nahi… thodi si hai 😌',
      'Aaj %s kar lo, phir shaam free free.']
    when 'mine2' then array[
      '%s tumhare deck pe itne din se hai, ab rent maangega.',
      '%s ne mujhse poocha, "Mera number kab aayega?" Main kya bolun?',
      '{Main gin raha hoon|Main gin rahi hoon|Hum gin rahe hain}: %s, din number ab bahut ho gaye 👀',
      '%s ko itna wait karwaoge toh woh rootha baitha hai.',
      '%s abhi bhi pending? Kal ka kal, aaj ka aaj, yaar.',
      'Ek kaam karo, %s khatam karo, phir main chup. Promise 🤐']
    when 'mine3' then array[
      '%s. Aaj. No excuses, {main dekh raha hoon|main dekh rahi hoon|hum dekh rahe hain} 👀',
      'Bahut ho gaya, %s aaj hi. {Main saath hoon|Main saath hoon|Hum saath hain} 💪',
      '%s ko aur kitna lataoge? Aaj finish line.',
      'Seedhi baat: %s aaj karna hai. Bas.',
      '%s abhi karo, phir pura din tumhara. {Pakka promise|Pakki promise|Promise} 🤞',
      '{Main thak gaya|Main thak gayi|Yaad dila dila ke thak gaye} {yaad dila dila ke|yaad dila dila ke|} 😩 %s, please?']
    when 'table1' then array[
      '%s table pe akela baitha hai. Koi utha lo?',
      '%s ko ek ghar chahiye. Tumhara deck kaisa rahega? 🏠',
      'Table pe %s chupchaap wait kar raha hai.',
      '%s, kisi ka bhi ho sakta hai… tumhara bhi 😉',
      'Psst, %s abhi bhi table pe hai.',
      '%s free hai, le lo jaldi, pehle aao pehle paao.']
    when 'table2' then array[
      '%s ko adopt karne wala koi nahi? Sad scene 😢',
      '%s table pe itne din se hai, ab furniture lagne laga.',
      '%s: "Main bhi task hoon, mujhe bhi koi le lo."',
      'Tum dono %s ko dekh ke nikal jaate ho, maine notice kiya 👀',
      '%s pe dhool jamne lagi hai. Koi phoonk maaro!',
      'Table pe %s, toss karke decide kar lo kaun lega 🪙']
    when 'table3' then array[
      '%s kab se pada hai. Aaj koi toh le lo!',
      'Bas, %s aaj kisi ke deck pe jaana chahiye.',
      '%s ko aur ignore nahi chalega. Utha lo, ya saath karo.',
      'Seedhi baat: %s aaj kisi ka hona chahiye.',
      '%s ko table pe hi zindagi bitani hai kya? Aaj decide karo.',
      '{Main bol raha hoon|Main bol rahi hoon|Hum bol rahe hain}, %s aaj. Ya toh lo, ya "Do it together" karo.']
  end;
  if lines is null then return null; end if;
  line := lines[1 + (abs(seed) % array_length(lines, 1))];
  loop
    m := regexp_match(line, '\{([^|}]*)\|([^|}]*)\|([^}]*)\}');
    exit when m is null;
    line := regexp_replace(line, '\{[^|}]*\|[^|}]*\|[^}]*\}', m[pick]);
  end loop;
  return regexp_replace(line, '\s+', ' ', 'g');
end $$;

-- Same seed in the app: the sum of the task id's character codes plus the local day number.
create or replace function public.nudge_seed(task uuid, local_day date) returns int
language sql immutable as $$
  select (select coalesce(sum(ascii(c)), 0) from regexp_split_to_table(task::text, '') c)::int
    + (local_day - date '1970-01-01')
$$;

-- push_tick from 0006, with the nudge branch rebuilt around the partner's mascot. The 'hand'
-- branch and the token clean up are unchanged.
create or replace function public.push_tick() returns int
language plpgsql security definer set search_path = public as $$
declare
  m members;
  p members;
  l timestamp;
  day_start timestamptz;
  last_hand timestamptz;
  fresh text[];
  stale record;
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

    -- Mascot nudges: cards I'm sitting on, our together cards, and Table cards nobody took.
    -- The most ignored first; a card comes back sooner the firmer it has got, a Table card at
    -- most every 3 days. Still at most 2 a day, 4 hours apart, between 10:00 and 19:59.
    if extract(hour from l) between 10 and 19
      and (select count(*) from push_outbox where member = m.id and kind = 'nudge' and created_at >= day_start) < 2
      and not exists (select 1 from push_outbox where member = m.id and kind = 'nudge' and created_at > now() - interval '4 hours')
    then
      select t.id, t.title, t.sort_at, c.kind, c.lvl into stale
      from tasks t
      cross join lateral (select
        case when t.owner = 'table' then 'table' else 'mine' end as kind,
        public.nudge_level(t.sort_at, m.nudge_max) as lvl) c
      where t.couple_id = m.couple_id
        and ((t.status = 'active' and t.owner in (m.side, 'together'))
          or (t.status = 'deal' and t.owner = 'table' and t.request is null and not t.surprise))
        and c.lvl >= 1
        and not exists (select 1 from push_outbox o where o.member = m.id and o.kind = 'nudge'
          and o.data ->> 'task_id' = t.id::text
          and o.created_at > now() - case
            when c.kind = 'table' then interval '3 days'
            when c.lvl = 3 then interval '1 day'
            when c.lvl = 2 then interval '2 days'
            else interval '3 days' end)
      order by c.lvl desc, t.sort_at
      limit 1;
      if stale.id is not null then
        select * into p from members where couple_id = m.couple_id and id <> m.id;
        insert into push_outbox (member, kind, title, body, data) values (m.id, 'nudge',
          coalesce(p.name, 'usync'),
          format(public.nudge_line(stale.kind, stale.lvl, public.nudge_seed(stale.id, l::date), coalesce(p.voice, 'neutral')), stale.title),
          jsonb_build_object('task_id', stale.id, 'level', stale.lvl, 'kind', stale.kind, 'from', p.id));
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
