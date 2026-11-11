-- Appreciate offers four now: 👍 ❤️ 😊 🎉 (Figma 299:25101). The older four stay valid so the
-- reactions already sent keep their meaning.

alter table public.thanks drop constraint if exists thanks_reaction_check;
alter table public.thanks add constraint thanks_reaction_check
  check (reaction in ('thumbs', 'heart', 'smile', 'party', 'care', 'laugh', 'wow', 'tears'));

create or replace function public.reaction_line(r text, who text) returns text
language sql immutable as $$
  select who || case r
    when 'thumbs' then ' gave you a thumbs up 👍'
    when 'smile' then ' smiled at this 😊'
    when 'party' then ' is celebrating this 🎉'
    when 'care' then ' sent you a hug 🤗'
    when 'laugh' then ' laughed at this 😂'
    when 'wow' then ' is impressed 😮'
    when 'tears' then ' is moved 🥹'
    else ' sent you a heart ❤️' end
$$;
