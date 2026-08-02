-- Ira Workspace v6 — Rasmus notification approval modes
-- Safe to run after 202608010001_ira_workspace_v5.sql.

alter table public.notifications
  add column if not exists delivery_mode text not null default 'auto'
  check (delivery_mode in ('auto','review'));

alter table public.notifications
  add column if not exists approved_at timestamptz;

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  kind text not null,
  delivery_mode text not null default 'review' check (delivery_mode in ('auto','review','off')),
  offset_minutes integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(teacher_id,kind)
);

alter table public.notification_rules enable row level security;
create policy "teacher manages notification rules"
  on public.notification_rules for all to authenticated
  using (teacher_id=auth.uid())
  with check (teacher_id=auth.uid());

create trigger notification_rules_updated
  before update on public.notification_rules
  for each row execute function public.set_updated_at();

create index if not exists notifications_delivery_due_idx
  on public.notifications(status,delivery_mode,send_at)
  where status='scheduled' and delivery_mode='auto';
