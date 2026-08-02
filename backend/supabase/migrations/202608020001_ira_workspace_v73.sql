-- Ira Workspace 7.3 — cloud workspace + student Telegram notifications
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  name text not null default 'Ира',
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_states (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_links (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id text not null,
  student_name text not null,
  portal_token uuid not null default gen_random_uuid(),
  telegram_chat_id bigint,
  telegram_username text,
  linked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (teacher_id, student_id),
  unique (portal_token)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id text,
  kind text not null,
  dedupe_key text not null,
  text text not null,
  send_at timestamptz not null,
  status text not null default 'review' check (status in ('review','queued','sent','dismissed','failed','blocked')),
  source jsonb not null default '{}'::jsonb,
  telegram_message_id bigint,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (teacher_id, dedupe_key)
);

create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id text not null,
  lesson_id text,
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_events_due_idx
  on public.notification_events(status, send_at);
create index if not exists student_links_chat_idx
  on public.student_links(telegram_chat_id);
create index if not exists reschedule_requests_teacher_idx
  on public.reschedule_requests(teacher_id, status, created_at desc);

alter table public.teachers enable row level security;
alter table public.workspace_states enable row level security;
alter table public.student_links enable row level security;
alter table public.notification_events enable row level security;
alter table public.reschedule_requests enable row level security;

-- The browser never talks to these tables directly. All access goes through
-- Edge Functions using the server secret key. Therefore no anon/authenticated
-- RLS policies are intentionally created.

grant all on public.teachers to service_role;
grant all on public.workspace_states to service_role;
grant all on public.student_links to service_role;
grant all on public.notification_events to service_role;
grant all on public.reschedule_requests to service_role;

-- Install/update the five-minute reminder worker without exposing the cron
-- secret in the app or in the cron command. Called only by workspace-api.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.install_ira_notification_cron(
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
  select id into v_project_id from vault.secrets where name = 'ira_workspace_project_url' limit 1;
  if v_project_id is null then
    perform vault.create_secret(rtrim(p_project_url, '/'), 'ira_workspace_project_url', 'Ira Workspace Supabase URL');
  else
    perform vault.update_secret(v_project_id, rtrim(p_project_url, '/'), 'ira_workspace_project_url', 'Ira Workspace Supabase URL');
  end if;

  select id into v_cron_id from vault.secrets where name = 'ira_workspace_cron_secret' limit 1;
  if v_cron_id is null then
    perform vault.create_secret(p_cron_secret, 'ira_workspace_cron_secret', 'Ira Workspace reminder worker secret');
  else
    perform vault.update_secret(v_cron_id, p_cron_secret, 'ira_workspace_cron_secret', 'Ira Workspace reminder worker secret');
  end if;

  begin
    perform cron.unschedule('ira-workspace-notifications');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'ira-workspace-notifications',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'ira_workspace_project_url') || '/functions/v1/process-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ira_workspace_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      ) as request_id;
    $job$
  );
end;
$$;

revoke all on function public.install_ira_notification_cron(text, text) from public, anon, authenticated;
grant execute on function public.install_ira_notification_cron(text, text) to service_role;
