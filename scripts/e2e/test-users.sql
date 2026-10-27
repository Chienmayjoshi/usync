do $$
declare u uuid; e text;
begin
  foreach e in array array['test-r@usync.dev', 'test-m@usync.dev'] loop
    if exists (select 1 from auth.users where email = e) then continue; end if;
    u := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e, extensions.crypt('usync-test-1', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), u, u::text, jsonb_build_object('sub', u::text, 'email', e, 'email_verified', true), 'email', now(), now(), now());
  end loop;
end $$;
select email from auth.users;
