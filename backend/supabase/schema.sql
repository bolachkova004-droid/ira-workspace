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
  currency text not null