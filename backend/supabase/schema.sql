-- Rasmus Beta 8.0.1 — secure multi-tenant base schema.
-- Apply every migration after this base. Version 8.1.0 keeps the 8.0.2
-- owner-recovery schema and adds auto-reports in the notification worker.
--
-- Goals:
--   * keep every existing teacher workspace and its data;
--   * exchange verified Telegram identity for a real Supabase Auth user;
--   * isolate every user-facing query with workspace membership + RLS;
--   * require one-time hashed beta/student invites;
--   * keep administrative metadata separate from teacher data;
--   * make reset recoverable for seven days.

begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Keep a database-side copy of legacy rows before changing table names. This is
-- deliberately append-only and inaccessible to browser roles.
create table if not exists private.rasmus_v8_migration_backup (
  id bigint generated always as identity primary key,
  source_table text not null,
  row_data jsonb not null,
  backed_up_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.teachers') is not null
     and not exists (select 1 from private.rasmus_v8_migration_backup where source_table = 'teachers') then
    insert into private.rasmus_v8_migration_backup(source_table, row_data)
    select 'teachers', to_jsonb(t) from public.teachers t;
  end if;
  if to_regclass('public.workspace_states') is not null
     and not exists (select 1 from private.rasmus_v8_migration_backup where source_table = 'workspace_states') then
    insert into private.rasmus_v8_migration_backup(source_table, row_data)
    select 'workspace_states', to_jsonb(t) from public.workspace_states t;
  end if;
  if to_regclass('public.student_links') is not null
     and not exists (select 1 from private.rasmus_v8_migration_backup where source_table = 'student_links') then
    insert into private.rasmus_v8_migration_backup(source_table, row_data)
    select 'student_links',
      (to_jsonb(t) - 'portal_token') || jsonb_build_object(
        'portal_token_hash',
        case when to_jsonb(t) ? 'portal_token'
          then encode(digest(to_jsonb(t)->>'portal_token','sha256'),'hex')
          else null end
      )
    from public.student_links t;
  end if;
  if to_regclass('public.notification_events') is not null
     and not exists (select 1 from private.rasmus_v8_migration_backup where source_table = 'notification_events') then
    insert into private.rasmus_v8_migration_backup(source_table, row_data)
    select 'notification_events', to_jsonb(t) from public.notification_events t;
  end if;
  if to_regclass('public.reschedule_requests') is not null
     and not exists (select 1 from private.rasmus_v8_migration_backup where source_table = 'reschedule_requests') then
    insert into private.rasmus_v8_migration_backup(source_table, row_data)
    select 'reschedule_requests', to_jsonb(t) from public.reschedule_requests t;
  end if;
end $$;

-- A clean installation may not contain the v7 tables. Define the minimum
-- legacy shape so the same migration works for both upgrades and new projects.
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  name text not null default 'Преподаватель',
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Move v7 tenant tables out of the exposed schema names once. The copies stay
-- available to the owner for rollback, but are never granted to app users.
do $$
begin
  if to_regclass('public.workspace_states') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='workspace_states' and column_name='teacher_id')
     and to_regclass('private.workspace_states_legacy_v7') is null then
    alter table public.workspace_states set schema private;
    alter table private.workspace_states rename to workspace_states_legacy_v7;
  end if;
  if to_regclass('public.student_links') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='student_links' and column_name='teacher_id')
     and to_regclass('private.student_links_legacy_v7') is null then
    alter table public.student_links set schema private;
    alter table private.student_links rename to student_links_legacy_v7;
  end if;
  if to_regclass('public.notification_events') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_events' and column_name='teacher_id')
     and to_regclass('private.notification_events_legacy_v7') is null then
    alter table public.notification_events set schema private;
    alter table private.notification_events rename to notification_events_legacy_v7;
  end if;
  if to_regclass('public.reschedule_requests') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='reschedule_requests' and column_name='teacher_id')
     and to_regclass('private.reschedule_requests_legacy_v7') is null then
    alter table public.reschedule_requests set schema private;
    alter table private.reschedule_requests rename to reschedule_requests_legacy_v7;
  end if;
end $$;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id bigint unique not null,
  telegram_username text,
  first_name text,
  last_name text,
  platform_role text not null default 'user' check (platform_role in ('user','admin')),
  beta_status text not null default 'active' check (beta_status in ('active','blocked')),
  last_active_at timestamptz,
  app_version text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Мой кабинет',
  currency text not null default 'RUB',
  timezone text not null default 'Europe/Moscow',
  created_by uuid references public.app_users(id) on delete set null,
  legacy_teacher_id uuid unique references public.teachers(id) on delete set null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspaces_single_primary_idx
  on public.workspaces((is_primary)) where is_primary;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

create table if not exists private.legacy_teacher_workspaces (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  workspace_id uuid unique not null references public.workspaces(id) on delete cascade,
  is_owner boolean not null default false,
  migrated_at timestamptz not null default now()
);

-- One workspace per legacy teacher. Platform ownership is assigned later from
-- the explicit OWNER_TELEGRAM_ID server secret; timestamps or row order are
-- never used to guess an administrator.
insert into public.workspaces(name, timezone, legacy_teacher_id, is_primary)
select coalesce(nullif(t.name,''),'Мой кабинет'), coalesce(nullif(t.timezone,''),'Europe/Moscow'), t.id, false
from public.teachers t
on conflict (legacy_teacher_id) do nothing;

insert into private.legacy_teacher_workspaces(teacher_id, workspace_id, is_owner)
select t.id, w.id, false
from public.teachers t
join public.workspaces w on w.legacy_teacher_id = t.id
on conflict (teacher_id) do update set workspace_id = excluded.workspace_id, is_owner = excluded.is_owner;

create table if not exists public.workspace_states (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('private.workspace_states_legacy_v7') is not null then
    insert into public.workspace_states(workspace_id, state, revision, updated_at)
    select m.workspace_id, s.state, s.revision, s.updated_at
    from private.workspace_states_legacy_v7 s
    join private.legacy_teacher_workspaces m on m.teacher_id = s.teacher_id
    on conflict (workspace_id) do nothing;
  end if;
end $$;

insert into public.workspace_states(workspace_id, state, revision)
select w.id,
  jsonb_build_object(
    'version','8.0.1-beta.1',
    'profile',jsonb_build_object('name',w.name,'currency',w.currency,'timezone',w.timezone,'onboardingComplete',false),
    'students','[]'::jsonb,
    'lessons','[]'::jsonb,
    'content','[]'::jsonb,
    'reminders','[]'::jsonb,
    'reminderSettings',jsonb_build_object(
      'payment','review','homework','auto','lesson','auto',
      'teacherLesson','auto','teacherDaily','auto','teacherReport','auto','lead','review'
    )
  ), 0
from public.workspaces w
on conflict (workspace_id) do nothing;

create table if not exists public.student_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id text not null,
  student_name text not null,
  telegram_user_id bigint,
  telegram_chat_id bigint,
  telegram_username text,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id),
  unique (workspace_id, id)
);

create index if not exists student_links_v8_chat_idx on public.student_links(telegram_chat_id);
create index if not exists student_links_v8_workspace_idx on public.student_links(workspace_id, student_id);

create table if not exists public.student_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_link_id uuid not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_telegram_user_id bigint,
  revoked_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, student_link_id)
    references public.student_links(workspace_id, id) on delete cascade
);

create index if not exists student_invites_active_idx on public.student_invites(token_hash, expires_at)
  where claimed_at is null and revoked_at is null;

create table if not exists public.student_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_link_id uuid not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, student_link_id)
    references public.student_links(workspace_id, id) on delete cascade
);

create index if not exists student_portal_tokens_active_idx on public.student_portal_tokens(token_hash, expires_at)
  where revoked_at is null;

do $$
begin
  if to_regclass('private.student_links_legacy_v7') is not null then
    insert into public.student_links(workspace_id, student_id, student_name, telegram_chat_id, telegram_username, linked_at, updated_at)
    select m.workspace_id, l.student_id, l.student_name, l.telegram_chat_id, l.telegram_username, l.linked_at, l.updated_at
    from private.student_links_legacy_v7 l
    join private.legacy_teacher_workspaces m on m.teacher_id = l.teacher_id
    on conflict (workspace_id, student_id) do nothing;

    -- Preserve legacy student portal URLs without keeping the raw token in the
    -- new schema. New invitations use independent, short-lived tokens.
    insert into public.student_portal_tokens(workspace_id, student_link_id, token_hash, expires_at, created_at)
    select n.workspace_id, n.id, encode(digest(l.portal_token::text,'sha256'),'hex'), now() + interval '365 days', coalesce(l.updated_at,now())
    from private.student_links_legacy_v7 l
    join private.legacy_teacher_workspaces m on m.teacher_id = l.teacher_id
    join public.student_links n on n.workspace_id = m.workspace_id and n.student_id = l.student_id
    on conflict (token_hash) do nothing;

    -- The hash above is sufficient to keep existing links working; do not
    -- retain the reusable raw portal token in the private legacy table.
    alter table private.student_links_legacy_v7 drop column if exists portal_token;
  end if;
end $$;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_link_id uuid,
  kind text not null,
  dedupe_key text not null,
  text text not null,
  send_at timestamptz not null,
  status text not null default 'review' check (status in ('review','queued','processing','sent','dismissed','failed','blocked')),
  source jsonb not null default '{}'::jsonb,
  telegram_message_id bigint,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (workspace_id, dedupe_key),
  foreign key (workspace_id, student_link_id)
    references public.student_links(workspace_id, id) on delete cascade
);

create index if not exists notification_events_v8_due_idx
  on public.notification_events(status, coalesce(next_attempt_at,send_at));
create index if not exists notification_events_v8_workspace_idx
  on public.notification_events(workspace_id, status, created_at desc);

do $$
begin
  if to_regclass('private.notification_events_legacy_v7') is not null then
    insert into public.notification_events(
      id, workspace_id, student_link_id, kind, dedupe_key, text, send_at,
      status, source, telegram_message_id, error, created_at, updated_at, sent_at
    )
    select e.id, m.workspace_id, sl.id, e.kind, e.dedupe_key, e.text, e.send_at,
      e.status, e.source, e.telegram_message_id, e.error, e.created_at, e.updated_at, e.sent_at
    from private.notification_events_legacy_v7 e
    join private.legacy_teacher_workspaces m on m.teacher_id = e.teacher_id
    left join public.student_links sl on sl.workspace_id = m.workspace_id and sl.student_id = e.student_id
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_link_id uuid not null,
  lesson_id text,
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, student_link_id)
    references public.student_links(workspace_id, id) on delete cascade
);

create index if not exists reschedule_requests_v8_workspace_idx
  on public.reschedule_requests(workspace_id, status, created_at desc);

do $$
begin
  if to_regclass('private.reschedule_requests_legacy_v7') is not null then
    insert into public.reschedule_requests(id, workspace_id, student_link_id, lesson_id, note, status, created_at, updated_at)
    select r.id, m.workspace_id, sl.id, r.lesson_id, r.note, r.status, r.created_at, r.updated_at
    from private.reschedule_requests_legacy_v7 r
    join private.legacy_teacher_workspaces m on m.teacher_id = r.teacher_id
    join public.student_links sl on sl.workspace_id = m.workspace_id and sl.student_id = r.student_id
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  label text,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by uuid references public.app_users(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists beta_invites_active_idx on public.beta_invites(token_hash, expires_at)
  where claimed_at is null and revoked_at is null;

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('feedback','bug')),
  message text not null,
  screen text,
  app_version text,
  platform text,
  technical_id text,
  status text not null default 'new' check (status in ('new','reviewed','resolved')),
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_created_idx on public.beta_feedback(created_at desc);

create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.app_users(id) on delete cascade,
  reason text not null,
  state jsonb not null,
  linked_students jsonb not null default '[]'::jsonb,
  revision bigint not null,
  expires_at timestamptz not null,
  restored_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.workspace_snapshots
  add column if not exists linked_students jsonb not null default '[]'::jsonb;

create index if not exists workspace_snapshots_active_idx on public.workspace_snapshots(workspace_id, created_at desc)
  where restored_at is null;

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid unique not null references public.workspaces(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  account_email text,
  calendar_id text not null default 'primary',
  refresh_token_ciphertext text not null,
  scopes text[] not null default array['https://www.googleapis.com/auth/calendar.events'],
  connected_by uuid not null references public.app_users(id) on delete cascade,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  state_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists calendar_oauth_states_active_idx on public.calendar_oauth_states(state_hash, expires_at)
  where used_at is null;

create table if not exists public.calendar_event_links (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lesson_id text not null,
  provider_event_id text not null,
  last_payload_hash text,
  synced_at timestamptz not null default now(),
  primary key (workspace_id, lesson_id)
);

-- RLS helper functions are kept in a non-exposed schema. They use auth.uid()
-- and never accept a user id supplied by the browser.
create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    join public.app_users u on u.id = wm.user_id
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and u.beta_status = 'active'
  );
$$;

create or replace function private.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    join public.app_users u on u.id = wm.user_id
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.role = 'owner'
      and u.beta_status = 'active'
  );
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_users u
    where u.id = (select auth.uid())
      and u.platform_role = 'admin'
      and u.beta_status = 'active'
  );
$$;

create or replace function private.safe_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.is_workspace_owner(uuid) from public;
revoke all on function private.is_platform_admin() from public;
revoke all on function private.safe_uuid(text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.safe_uuid(text) to authenticated, service_role;

-- Atomic provisioning. Only a server holding the Supabase secret key can call
-- these functions; the raw invite token never enters the database.
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
  select t.id as teacher_id, m.workspace_id, m.is_owner
    into legacy_record
  from public.teachers t
  join private.legacy_teacher_workspaces m on m.teacher_id = t.id
  where t.telegram_id = p_telegram_user_id
  limit 1;

  if legacy_record.workspace_id is null then
    raise exception 'legacy_teacher_not_found';
  end if;

  -- Only the explicitly configured owner is grandfathered automatically.
  -- Every other legacy record must be re-authorized with a fresh one-time
  -- beta invitation; its existing workspace is preserved and reattached.
  if not p_is_platform_owner then
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
  end if;

  insert into public.app_users(
    id, telegram_user_id, telegram_username, first_name, last_name, platform_role
  ) values (
    p_auth_user_id, p_telegram_user_id, nullif(p_telegram_username,''),
    nullif(p_first_name,''), nullif(p_last_name,''),
    case when p_is_platform_owner then 'admin' else 'user' end
  )
  on conflict (id) do update set
    telegram_username = excluded.telegram_username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = now();

  insert into public.workspace_members(workspace_id, user_id, role)
  values (legacy_record.workspace_id, p_auth_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  update public.workspaces
  set created_by = coalesce(created_by,p_auth_user_id), updated_at = now()
  where id = legacy_record.workspace_id;

  if p_is_platform_owner then
    update public.app_users
      set platform_role = 'user', updated_at = now()
      where id <> p_auth_user_id and platform_role = 'admin';
    update public.workspaces set is_primary = (id = legacy_record.workspace_id), updated_at = now();
    update private.legacy_teacher_workspaces set is_owner = (workspace_id = legacy_record.workspace_id);
  else
    update public.beta_invites
      set claimed_at = now(), claimed_by = p_auth_user_id
      where id = invite_record.id;
  end if;

  return legacy_record.workspace_id;
end;
$$;

create or replace function public.rasmus_claim_beta_invite(
  p_auth_user_id uuid,
  p_telegram_user_id bigint,
  p_telegram_username text,
  p_first_name text,
  p_last_name text,
  p_token_hash text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_record public.beta_invites%rowtype;
  new_workspace_id uuid := gen_random_uuid();
  display_name text;
begin
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

  if exists(select 1 from public.app_users where telegram_user_id = p_telegram_user_id) then
    raise exception 'telegram_user_already_registered';
  end if;

  display_name := trim(concat_ws(' ',nullif(p_first_name,''),nullif(p_last_name,'')));
  if display_name = '' then display_name := 'Преподаватель'; end if;

  insert into public.app_users(
    id, telegram_user_id, telegram_username, first_name, last_name
  ) values (
    p_auth_user_id, p_telegram_user_id, nullif(p_telegram_username,''),
    nullif(p_first_name,''), nullif(p_last_name,'')
  );

  insert into public.workspaces(id, name, created_by)
  values (new_workspace_id, display_name, p_auth_user_id);

  insert into public.workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, p_auth_user_id, 'owner');

  insert into public.workspace_states(workspace_id, state, revision)
  values (
    new_workspace_id,
    jsonb_build_object(
      'version','8.0.1-beta.1',
      'profile',jsonb_build_object('name',display_name,'currency','RUB','timezone','Europe/Moscow','onboardingComplete',false),
      'students','[]'::jsonb,
      'lessons','[]'::jsonb,
      'content','[]'::jsonb,
      'reminders','[]'::jsonb,
      'reminderSettings',jsonb_build_object(
        'payment','review','homework','auto','lesson','auto',
        'teacherLesson','auto','teacherDaily','auto','teacherReport','auto','lead','review'
      )
    ),
    0
  );

  update public.beta_invites
  set claimed_at = now(), claimed_by = p_auth_user_id
  where id = invite_record.id;

  return new_workspace_id;
end;
$$;

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
declare
  new_workspace_id uuid := gen_random_uuid();
  display_name text;
begin
  if exists(select 1 from public.app_users where platform_role = 'admin') then
    raise exception 'platform_owner_already_exists';
  end if;
  display_name := trim(concat_ws(' ',nullif(p_first_name,''),nullif(p_last_name,'')));
  if display_name = '' then display_name := 'Ирина'; end if;

  insert into public.app_users(id,telegram_user_id,telegram_username,first_name,last_name,platform_role)
  values(p_auth_user_id,p_telegram_user_id,nullif(p_telegram_username,''),nullif(p_first_name,''),nullif(p_last_name,''),'admin');
  insert into public.workspaces(id,name,created_by,is_primary)
  values(new_workspace_id,display_name,p_auth_user_id,true);
  insert into public.workspace_members(workspace_id,user_id,role)
  values(new_workspace_id,p_auth_user_id,'owner');
  insert into public.workspace_states(workspace_id,state,revision)
  values(new_workspace_id,jsonb_build_object(
    'version','8.0.1-beta.1',
    'profile',jsonb_build_object('name',display_name,'currency','RUB','timezone','Europe/Moscow','onboardingComplete',false),
    'students','[]'::jsonb,'lessons','[]'::jsonb,'content','[]'::jsonb,'reminders','[]'::jsonb,
    'reminderSettings',jsonb_build_object('payment','review','homework','auto','lesson','auto','teacherLesson','auto','teacherDaily','auto','teacherReport','auto','lead','review')
  ),0);
  return new_workspace_id;
end;
$$;

create or replace function public.rasmus_claim_student_invite(
  p_token_hash text,
  p_telegram_user_id bigint,
  p_telegram_chat_id bigint,
  p_telegram_username text
) returns table(workspace_id uuid, student_link_id uuid, student_id text, student_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_record public.student_invites%rowtype;
begin
  select * into invite_record
  from public.student_invites
  where token_hash = p_token_hash
    and claimed_at is null
    and revoked_at is null
    and expires_at > now()
  for update;
  if invite_record.id is null then
    raise exception 'student_invite_invalid';
  end if;

  update public.student_links
  set telegram_user_id = p_telegram_user_id,
      telegram_chat_id = p_telegram_chat_id,
      telegram_username = nullif(p_telegram_username,''),
      linked_at = now(),
      updated_at = now()
  where id = invite_record.student_link_id
    and workspace_id = invite_record.workspace_id;

  update public.student_invites
  set claimed_at = now(), claimed_telegram_user_id = p_telegram_user_id
  where id = invite_record.id;

  return query
  select l.workspace_id, l.id, l.student_id, l.student_name
  from public.student_links l
  where l.id = invite_record.student_link_id
    and l.workspace_id = invite_record.workspace_id;
end;
$$;

-- A beta reset touches state, links, invitations and notification jobs. Keep
-- the whole operation in one database transaction so a network failure cannot
-- leave a half-cleared workspace.
create or replace function public.rasmus_reset_beta_workspace(
  p_workspace_id uuid,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace public.workspaces%rowtype;
  v_document public.workspace_states%rowtype;
  v_snapshot_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
  v_empty_state jsonb;
  v_linked_students jsonb;
  v_revision bigint;
begin
  if p_confirmation <> 'ОЧИСТИТЬ' then
    raise exception 'reset_confirmation_invalid';
  end if;
  if v_user_id is null or not exists (
    select 1 from public.workspace_members wm
    join public.app_users u on u.id = wm.user_id
    where wm.workspace_id = p_workspace_id and wm.user_id = v_user_id
      and wm.role = 'owner' and u.beta_status = 'active'
  ) then
    raise exception 'workspace_owner_required';
  end if;
  if exists (
    select 1 from public.app_users
    where id = v_user_id and platform_role = 'admin'
  ) then
    raise exception 'primary_workspace_reset_forbidden';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id for update;
  if v_workspace.id is null or v_workspace.is_primary then
    raise exception 'primary_workspace_reset_forbidden';
  end if;
  select * into v_document from public.workspace_states where workspace_id = p_workspace_id for update;
  if v_document.workspace_id is null then
    raise exception 'workspace_state_missing';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', l.student_id,
    'student_name', l.student_name,
    'telegram_user_id', l.telegram_user_id,
    'telegram_chat_id', l.telegram_chat_id,
    'telegram_username', l.telegram_username,
    'linked_at', l.linked_at
  )), '[]'::jsonb)
  into v_linked_students
  from public.student_links l
  where l.workspace_id = p_workspace_id;

  insert into public.workspace_snapshots(
    workspace_id, created_by, reason, state, linked_students, revision, expires_at
  ) values (
    p_workspace_id, v_user_id, 'beta_reset', v_document.state,
    v_linked_students, v_document.revision, v_expires_at
  ) returning id into v_snapshot_id;

  update public.notification_events
    set status = 'dismissed', error = 'Workspace reset', updated_at = now()
    where workspace_id = p_workspace_id
      and status in ('review','queued','processing','blocked','failed');
  update public.student_invites set revoked_at = now()
    where workspace_id = p_workspace_id and revoked_at is null;
  update public.student_portal_tokens set revoked_at = now()
    where workspace_id = p_workspace_id and revoked_at is null;
  delete from public.student_links where workspace_id = p_workspace_id;

  v_empty_state := jsonb_build_object(
    'version','8.0.1-beta.1',
    'profile',jsonb_build_object(
      'name',v_workspace.name,'currency',v_workspace.currency,
      'timezone',v_workspace.timezone,'onboardingComplete',true
    ),
    'students','[]'::jsonb,'lessons','[]'::jsonb,
    'content','[]'::jsonb,'reminders','[]'::jsonb,
    'reminderSettings',jsonb_build_object(
      'payment','review','homework','auto','lesson','auto',
      'teacherLesson','auto','teacherDaily','auto','teacherReport','auto','lead','review'
    ),
    'analytics',jsonb_build_object('period','30','sources','[]'::jsonb)
  );
  v_revision := v_document.revision + 1;
  update public.workspace_states
    set state = v_empty_state, revision = v_revision, updated_at = now()
    where workspace_id = p_workspace_id;

  return jsonb_build_object(
    'state',v_empty_state,
    'revision',v_revision,
    'recovery',jsonb_build_object('id',v_snapshot_id,'expires_at',v_expires_at)
  );
end;
$$;

create or replace function public.rasmus_restore_beta_workspace(
  p_workspace_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace public.workspaces%rowtype;
  v_document public.workspace_states%rowtype;
  v_snapshot public.workspace_snapshots%rowtype;
  v_revision bigint;
begin
  if v_user_id is null or not exists (
    select 1 from public.workspace_members wm
    join public.app_users u on u.id = wm.user_id
    where wm.workspace_id = p_workspace_id and wm.user_id = v_user_id
      and wm.role = 'owner' and u.beta_status = 'active'
  ) then
    raise exception 'workspace_owner_required';
  end if;
  if exists (
    select 1 from public.app_users
    where id = v_user_id and platform_role = 'admin'
  ) then
    raise exception 'primary_workspace_restore_forbidden';
  end if;
  select * into v_workspace from public.workspaces where id = p_workspace_id for update;
  if v_workspace.id is null or v_workspace.is_primary then
    raise exception 'primary_workspace_restore_forbidden';
  end if;
  select * into v_document from public.workspace_states where workspace_id = p_workspace_id for update;
  select * into v_snapshot
    from public.workspace_snapshots
    where workspace_id = p_workspace_id
      and restored_at is null and expires_at > now()
    order by created_at desc
    limit 1
    for update;
  if v_snapshot.id is null then
    raise exception 'reset_snapshot_not_found';
  end if;

  v_revision := v_document.revision + 1;
  update public.workspace_states
    set state = v_snapshot.state, revision = v_revision, updated_at = now()
    where workspace_id = p_workspace_id;

  insert into public.student_links(
    workspace_id, student_id, student_name, telegram_user_id,
    telegram_chat_id, telegram_username, linked_at, updated_at
  )
  select p_workspace_id, x.student_id, x.student_name, x.telegram_user_id,
    x.telegram_chat_id, x.telegram_username, x.linked_at, now()
  from jsonb_to_recordset(v_snapshot.linked_students) as x(
    student_id text, student_name text, telegram_user_id bigint,
    telegram_chat_id bigint, telegram_username text, linked_at timestamptz
  )
  where x.student_id is not null
  on conflict (workspace_id, student_id) do update set
    student_name = excluded.student_name,
    telegram_user_id = excluded.telegram_user_id,
    telegram_chat_id = excluded.telegram_chat_id,
    telegram_username = excluded.telegram_username,
    linked_at = excluded.linked_at,
    updated_at = now();

  update public.workspace_snapshots set restored_at = now() where id = v_snapshot.id;
  return jsonb_build_object('state',v_snapshot.state,'revision',v_revision);
end;
$$;

revoke all on function public.rasmus_claim_legacy_user(uuid,bigint,text,text,text,boolean,text) from public, anon, authenticated;
revoke all on function public.rasmus_claim_beta_invite(uuid,bigint,text,text,text,text) from public, anon, authenticated;
revoke all on function public.rasmus_bootstrap_owner_user(uuid,bigint,text,text,text) from public, anon, authenticated;
revoke all on function public.rasmus_claim_student_invite(text,bigint,bigint,text) from public, anon, authenticated;
revoke all on function public.rasmus_reset_beta_workspace(uuid,text) from public, anon;
revoke all on function public.rasmus_restore_beta_workspace(uuid) from public, anon;
grant execute on function public.rasmus_claim_legacy_user(uuid,bigint,text,text,text,boolean,text) to service_role;
grant execute on function public.rasmus_claim_beta_invite(uuid,bigint,text,text,text,text) to service_role;
grant execute on function public.rasmus_bootstrap_owner_user(uuid,bigint,text,text,text) to service_role;
grant execute on function public.rasmus_claim_student_invite(text,bigint,bigint,text) to service_role;
grant execute on function public.rasmus_reset_beta_workspace(uuid,text) to authenticated, service_role;
grant execute on function public.rasmus_restore_beta_workspace(uuid) to authenticated, service_role;

-- Enable RLS on every exposed table and define explicit policies per action.
alter table public.app_users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_states enable row level security;
alter table public.student_links enable row level security;
alter table public.student_invites enable row level security;
alter table public.student_portal_tokens enable row level security;
alter table public.notification_events enable row level security;
alter table public.reschedule_requests enable row level security;
alter table public.beta_invites enable row level security;
alter table public.beta_feedback enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_oauth_states enable row level security;
alter table public.calendar_event_links enable row level security;

drop policy if exists app_users_self_select on public.app_users;
create policy app_users_self_select on public.app_users for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists workspaces_member_select on public.workspaces;
create policy workspaces_member_select on public.workspaces for select to authenticated
using ((select private.is_workspace_member(id)));
drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_owner_update on public.workspaces for update to authenticated
using ((select private.is_workspace_owner(id)))
with check ((select private.is_workspace_owner(id)));

drop policy if exists workspace_members_self_select on public.workspace_members;
create policy workspace_members_self_select on public.workspace_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists workspace_states_member_select on public.workspace_states;
create policy workspace_states_member_select on public.workspace_states for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
drop policy if exists workspace_states_member_insert on public.workspace_states;
create policy workspace_states_member_insert on public.workspace_states for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)));
drop policy if exists workspace_states_member_update on public.workspace_states;
create policy workspace_states_member_update on public.workspace_states for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

drop policy if exists student_links_member_all on public.student_links;
create policy student_links_member_all on public.student_links for all to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

drop policy if exists student_invites_member_all on public.student_invites;
create policy student_invites_member_all on public.student_invites for all to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

drop policy if exists student_portal_tokens_member_all on public.student_portal_tokens;
create policy student_portal_tokens_member_all on public.student_portal_tokens for all to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

drop policy if exists notification_events_member_all on public.notification_events;
create policy notification_events_member_all on public.notification_events for all to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

drop policy if exists reschedule_requests_member_all on public.reschedule_requests;
create policy reschedule_requests_member_all on public.reschedule_requests for all to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

drop policy if exists beta_invites_admin_all on public.beta_invites;
create policy beta_invites_admin_all on public.beta_invites for all to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()) and created_by = (select auth.uid()));

drop policy if exists beta_feedback_own_insert on public.beta_feedback;
create policy beta_feedback_own_insert on public.beta_feedback for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);
drop policy if exists beta_feedback_admin_select on public.beta_feedback;
create policy beta_feedback_admin_select on public.beta_feedback for select to authenticated
using ((select private.is_platform_admin()));
drop policy if exists beta_feedback_admin_update on public.beta_feedback;
create policy beta_feedback_admin_update on public.beta_feedback for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

drop policy if exists workspace_snapshots_owner_all on public.workspace_snapshots;
create policy workspace_snapshots_owner_all on public.workspace_snapshots for all to authenticated
using ((select private.is_workspace_owner(workspace_id)))
with check ((select private.is_workspace_owner(workspace_id)) and created_by = (select auth.uid()));

drop policy if exists calendar_oauth_states_owner_all on public.calendar_oauth_states;
create policy calendar_oauth_states_owner_all on public.calendar_oauth_states for all to authenticated
using ((select private.is_workspace_owner(workspace_id)))
with check ((select private.is_workspace_owner(workspace_id)) and user_id = (select auth.uid()));

drop policy if exists calendar_event_links_member_all on public.calendar_event_links;
create policy calendar_event_links_member_all on public.calendar_event_links for all to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

-- Calendar refresh tokens are deliberately unavailable to authenticated API
-- clients. Edge Functions read them with the server key only after validating
-- workspace membership.

revoke all on public.app_users, public.workspaces, public.workspace_members,
  public.workspace_states, public.student_links, public.student_invites,
  public.student_portal_tokens, public.notification_events,
  public.reschedule_requests, public.beta_invites, public.beta_feedback,
  public.workspace_snapshots, public.calendar_connections,
  public.calendar_oauth_states, public.calendar_event_links from anon, authenticated;
grant select on public.app_users, public.workspaces, public.workspace_members to authenticated;
grant select, insert, update on public.workspace_states to authenticated;
grant select, delete on public.student_links to authenticated;
grant insert (workspace_id, student_id, student_name, updated_at)
  on public.student_links to authenticated;
grant update (student_name, updated_at)
  on public.student_links to authenticated;
grant insert, update on public.student_invites, public.student_portal_tokens to authenticated;
grant select, insert, update on public.notification_events to authenticated;
grant select on public.reschedule_requests to authenticated;
grant insert on public.beta_invites to authenticated;
grant select, insert, update on public.beta_feedback to authenticated;
grant select on public.workspace_snapshots to authenticated;
grant insert on public.calendar_oauth_states to authenticated;
grant update (name, currency, timezone, updated_at) on public.workspaces to authenticated;

grant all on public.app_users, public.workspaces, public.workspace_members,
  public.workspace_states, public.student_links, public.student_invites,
  public.student_portal_tokens, public.notification_events,
  public.reschedule_requests, public.beta_invites, public.beta_feedback,
  public.workspace_snapshots, public.calendar_connections,
  public.calendar_oauth_states, public.calendar_event_links to service_role;

-- Private file bucket. The first path segment must be a workspace UUID.
insert into storage.buckets(id,name,public)
values ('rasmus-private','rasmus-private',false)
on conflict (id) do update set public = false;

drop policy if exists rasmus_storage_member_select on storage.objects;
create policy rasmus_storage_member_select on storage.objects for select to authenticated
using (
  bucket_id = 'rasmus-private'
  and (select private.is_workspace_member(private.safe_uuid((storage.foldername(name))[1])))
);
drop policy if exists rasmus_storage_member_insert on storage.objects;
create policy rasmus_storage_member_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'rasmus-private'
  and (select private.is_workspace_member(private.safe_uuid((storage.foldername(name))[1])))
);
drop policy if exists rasmus_storage_member_update on storage.objects;
create policy rasmus_storage_member_update on storage.objects for update to authenticated
using (
  bucket_id = 'rasmus-private'
  and (select private.is_workspace_member(private.safe_uuid((storage.foldername(name))[1])))
)
with check (
  bucket_id = 'rasmus-private'
  and (select private.is_workspace_member(private.safe_uuid((storage.foldername(name))[1])))
);
drop policy if exists rasmus_storage_member_delete on storage.objects;
create policy rasmus_storage_member_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'rasmus-private'
  and (select private.is_workspace_member(private.safe_uuid((storage.foldername(name))[1])))
);

-- Idempotent five-minute worker setup. Called by the deploy-only setup
-- function; secrets are stored in Vault and never embedded in SQL or the app.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.install_rasmus_notification_cron(
  p_project_url text,
  p_cron_secret text
) returns void
language plpgsql
security definer
set search_path = public, cron, net, vault
as $$
declare
  v_project_id uuid;
  v_cron_id uuid;
begin
  select id into v_project_id from vault.secrets where name = 'rasmus_project_url' limit 1;
  if v_project_id is null then
    perform vault.create_secret(rtrim(p_project_url, '/'), 'rasmus_project_url', 'Rasmus Supabase URL');
  else
    perform vault.update_secret(v_project_id, rtrim(p_project_url, '/'), 'rasmus_project_url', 'Rasmus Supabase URL');
  end if;

  select id into v_cron_id from vault.secrets where name = 'rasmus_cron_secret' limit 1;
  if v_cron_id is null then
    perform vault.create_secret(p_cron_secret, 'rasmus_cron_secret', 'Rasmus reminder worker secret');
  else
    perform vault.update_secret(v_cron_id, p_cron_secret, 'rasmus_cron_secret', 'Rasmus reminder worker secret');
  end if;

  begin perform cron.unschedule('ira-workspace-notifications'); exception when others then null; end;
  begin perform cron.unschedule('rasmus-notifications'); exception when others then null; end;

  perform cron.schedule(
    'rasmus-notifications',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'rasmus_project_url') || '/functions/v1/process-notifications',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'rasmus_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      ) as request_id;
    $job$
  );
end;
$$;

revoke all on function public.install_rasmus_notification_cron(text,text) from public, anon, authenticated;
grant execute on function public.install_rasmus_notification_cron(text,text) to service_role;

create table if not exists private.rasmus_v8_migration_audit (
  migration text primary key,
  details jsonb not null,
  completed_at timestamptz not null default now()
);

insert into private.rasmus_v8_migration_audit(migration,details)
values ('202608100001_rasmus_beta_v8_secure',jsonb_build_object(
  'legacy_teachers',(select count(*) from public.teachers),
  'workspaces',(select count(*) from public.workspaces),
  'workspace_states',(select count(*) from public.workspace_states),
  'student_links',(select count(*) from public.student_links),
  'notification_events',(select count(*) from public.notification_events),
  'reschedule_requests',(select count(*) from public.reschedule_requests)
))
on conflict (migration) do update set details = excluded.details, completed_at = now();

commit;
