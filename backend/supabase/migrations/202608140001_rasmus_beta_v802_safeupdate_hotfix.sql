-- Rasmus Beta 8.0.2 hotfix — make owner recovery compatible with Supabase's
-- safe-update guard. The previous function contained one UPDATE without a
-- WHERE clause and was rejected at runtime with SQLSTATE 21000.

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

  update public.workspaces
  set is_primary = false, updated_at = now()
  where is_primary and id <> target_workspace_id;

  update public.workspaces
  set is_primary = true,
      created_by = p_auth_user_id,
      name = case when pg_catalog.btrim(name) = '' then display_name else name end,
      updated_at = now()
  where id = target_workspace_id;

  -- A real predicate is required by pg-safeupdate. It also avoids touching
  -- unchanged legacy mappings.
  update private.legacy_teacher_workspaces
  set is_owner = (workspace_id = target_workspace_id)
  where is_owner is distinct from (workspace_id = target_workspace_id);

  return target_workspace_id;
end;
$$;

revoke all on function public.rasmus_recover_owner_user(uuid,bigint,text,text,text)
  from public, anon, authenticated;
grant execute on function public.rasmus_recover_owner_user(uuid,bigint,text,text,text)
  to service_role;

insert into private.rasmus_v8_migration_audit(migration,details)
values ('202608140001_rasmus_beta_v802_safeupdate_hotfix',jsonb_build_object(
  'reason','SQLSTATE 21000: UPDATE requires a WHERE clause',
  'function','rasmus_recover_owner_user'
))
on conflict (migration) do update
set details = excluded.details, completed_at = now();

commit;
