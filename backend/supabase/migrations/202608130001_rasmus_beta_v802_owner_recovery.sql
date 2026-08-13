-- Rasmus Beta 8.0.2 — recover the configured owner after an interrupted or
-- partially completed v7 -> v8 authentication migration.

begin;

create or replace function public.rasmus_recover_owner_user(
  p_auth_user_id uuid,
  p_telegram_user_id bigint,
  p_telegram_username text,
  p_first_name text,
  p_last_name text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  bound_user_id uuid;
  display_name text;
begin
  if p_auth_user_id is null or p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'owner_identity_invalid';
  end if;

  -- Only one owner recovery may choose or promote a workspace at a time.
  perform pg_catalog.pg_advisory_xact_lock(8124602137401);

  select u.id into bound_user_id
  from public.app_users u
  where u.telegram_user_id = p_telegram_user_id
  limit 1;

  if bound_user_id is not null and bound_user_id <> p_auth_user_id then
    raise exception 'owner_telegram_bound_to_another_auth_user';
  end if;

  display_name := pg_catalog.btrim(pg_catalog.concat_ws(
    ' ', nullif(p_first_name,''), nullif(p_last_name,'')
  ));
  if display_name = '' then display_name := 'Ирина'; end if;

  -- Prefer the preserved legacy workspace, then an existing membership, then
  -- the current primary workspace. No existing teacher data is deleted.
  select m.workspace_id into target_workspace_id
  from public.teachers t
  join private.legacy_teacher_workspaces m on m.teacher_id = t.id
  where t.telegram_id = p_telegram_user_id
  limit 1;

  if target_workspace_id is null then
    select w.id into target_workspace_id
    from public.teachers t
    join public.workspaces w on w.legacy_teacher_id = t.id
    where t.telegram_id = p_telegram_user_id
    limit 1;
  end if;

  if target_workspace_id is null then
    select wm.workspace_id into target_workspace_id
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.user_id = p_auth_user_id
    order by w.is_primary desc, wm.created_at asc
    limit 1;
  end if;

  if target_workspace_id is null then
    select w.id into target_workspace_id
    from public.workspaces w
    where w.is_primary
    order by w.updated_at desc
    limit 1;
  end if;

  insert into public.app_users(
    id, telegram_user_id, telegram_username, first_name, last_name,
    platform_role, beta_status
  ) values (
    p_auth_user_id, p_telegram_user_id, nullif(p_telegram_username,''),
    nullif(p_first_name,''), nullif(p_last_name,''), 'admin', 'active'
  )
  on conflict (id) do update set
    telegram_user_id = excluded.telegram_user_id,
    telegram_username = excluded.telegram_username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    platform_role = 'admin',
    beta_status = 'active',
    updated_at = now();

  if target_workspace_id is null then
    target_workspace_id := gen_random_uuid();
    insert into public.workspaces(id, name, created_by, is_primary)
    values(target_workspace_id, display_name, p_auth_user_id, false);
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values(target_workspace_id, p_auth_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  insert into public.workspace_states(workspace_id, state, revision)
  values(target_workspace_id, jsonb_build_object(
    'version','8.0.2-beta.1',
    'profile',jsonb_build_object(
      'name',display_name,'currency','RUB','timezone','Europe/Moscow',
      'onboardingComplete',false
    ),
    'students','[]'::jsonb,
    'lessons','[]'::jsonb,
    'content','[]'::jsonb,
    'reminders','[]'::jsonb,
    'reminderSettings',jsonb_build_object(
      'payment','review','homework','auto','lesson','auto',
      'teacherLesson','auto','teacherDaily','auto','teacherReport','auto',
      'lead','review'
    )
  ),0)
  on conflict (workspace_id) do nothing;

  update public.app_users
  set platform_role = 'user', updated_at = now()
  where id <> p_auth_user_id and platform_role = 'admin';

  -- Clear any older primary row first. The previous one-statement boolean
  -- rewrite could hit the partial unique index before it cleared the old row.
  update public.workspaces
  set is_primary = false, updated_at = now()
  where is_primary and id <> target_workspace_id;

  update public.workspaces
  set is_primary = true,
      created_by = p_auth_user_id,
      name = case when pg_catalog.btrim(name) = '' then display_name else name end,
      updated_at = now()
  where id = target_workspace_id;

  update private.legacy_teacher_workspaces
  set is_owner = (workspace_id = target_workspace_id);

  return target_workspace_id;
end;
$$;

-- Keep the original RPC compatible with an Edge Function deployment that is
-- still finishing while this migration is already active.
create or replace function public.rasmus_bootstrap_owner_user(
  p_auth_user_id uuid,
  p_telegram_user_id bigint,
  p_telegram_username text,
  p_first_name text,
  p_last_name text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.rasmus_recover_owner_user(
    p_auth_user_id,
    p_telegram_user_id,
    p_telegram_username,
    p_first_name,
    p_last_name
  );
end;
$$;

-- The previous Edge Function sends legacy owners through this RPC. Route that
-- branch through the same recovery routine while retaining invite checks for
-- every ordinary legacy teacher.
create or replace function public.rasmus_claim_legacy_user(
  p_auth_user_id uuid,
  p_telegram_user_id bigint,
  p_telegram_username text,
  p_first_name text,
  p_last_name text,
  p_is_platform_owner boolean,
  p_token_hash text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  legacy_record record;
  invite_record public.beta_invites%rowtype;
begin
  if p_is_platform_owner then
    return public.rasmus_recover_owner_user(
      p_auth_user_id,
      p_telegram_user_id,
      p_telegram_username,
      p_first_name,
      p_last_name
    );
  end if;

  select t.id as teacher_id, m.workspace_id, m.is_owner
    into legacy_record
  from public.teachers t
  join private.legacy_teacher_workspaces m on m.teacher_id = t.id
  where t.telegram_id = p_telegram_user_id
  limit 1;

  if legacy_record.workspace_id is null then
    raise exception 'legacy_teacher_not_found';
  end if;

  select * into invite_record
  from public.beta_invites
  where token_hash = p_token_hash
    and claimed_at is null
    and revoked_at is null
    and expires_at > now()
  for update;
  if invite_record.id is null then
    raise exception 'beta_invite_invalid';
  end if;

  insert into public.app_users(
    id, telegram_user_id, telegram_username, first_name, last_name, platform_role
  ) values (
    p_auth_user_id, p_telegram_user_id, nullif(p_telegram_username,''),
    nullif(p_first_name,''), nullif(p_last_name,''), 'user'
  )
  on conflict (id) do update set
    telegram_username = excluded.telegram_username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = now();

  insert into public.workspace_members(workspace_id, user_id, role)
  values(legacy_record.workspace_id, p_auth_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  update public.workspaces
  set created_by = coalesce(created_by,p_auth_user_id), updated_at = now()
  where id = legacy_record.workspace_id;

  update public.beta_invites
  set claimed_at = now(), claimed_by = p_auth_user_id
  where id = invite_record.id;

  return legacy_record.workspace_id;
end;
$$;

revoke all on function public.rasmus_recover_owner_user(uuid,bigint,text,text,text)
  from public, anon, authenticated;
revoke all on function public.rasmus_bootstrap_owner_user(uuid,bigint,text,text,text)
  from public, anon, authenticated;
revoke all on function public.rasmus_claim_legacy_user(uuid,bigint,text,text,text,boolean,text)
  from public, anon, authenticated;

grant execute on function public.rasmus_recover_owner_user(uuid,bigint,text,text,text)
  to service_role;
grant execute on function public.rasmus_bootstrap_owner_user(uuid,bigint,text,text,text)
  to service_role;
grant execute on function public.rasmus_claim_legacy_user(uuid,bigint,text,text,text,boolean,text)
  to service_role;

insert into private.rasmus_v8_migration_audit(migration,details)
values ('202608130001_rasmus_beta_v802_owner_recovery',jsonb_build_object(
  'primary_workspaces',(select count(*) from public.workspaces where is_primary),
  'admin_users',(select count(*) from public.app_users where platform_role = 'admin')
))
on conflict (migration) do update
set details = excluded.details, completed_at = now();

commit;
