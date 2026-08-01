-- Ira Workspace v5 — production schema
create extension if not exists pgcrypto;

create type public.student_status as enum ('active','paused','finished');
create type public.lesson_status as enum ('scheduled','completed','rescheduled','cancelled');
create type public.payment_status as enum ('pending','paid','overdue');
create type public.homework_status as enum ('assigned','completed','overdue');
create type public.notification_status as enum ('scheduled','sent','failed','cancelled');
create type public.reschedule_status as enum ('new','accepted','declined');


create table public.workspace_snapshots (
  teacher_telegram_id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  telegram_id bigint unique,
  timezone text not null default 'Europe/Moscow',
  currency text not null default 'RUB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name text not null,
  telegram_id bigint,
  telegram_username text,
  phone text,
  level text,
  goal text,
  interests text,
  strengths text,
  challenges text,
  note text,
  timezone text not null default 'Europe/Moscow',
  lesson_price integer not null default 0 check (lesson_price >= 0),
  balance integer not null default 0,
  package_total integer not null default 0 check (package_total >= 0),
  package_used integer not null default 0 check (package_used >= 0),
  status public.student_status not null default 'active',
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_access_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 300),
  topic text not null,
  status public.lesson_status not null default 'scheduled',
  paid boolean not null default false,
  meeting_link text,
  plan text,
  notes text,
  errors text,
  homework_summary text,
  previous_starts_at timestamptz,
  reminder_24h boolean not null default true,
  reminder_2h boolean not null default true,
  reminder_15m boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount integer not null check (amount > 0),
  due_at timestamptz not null,
  paid_at timestamptz,
  status public.payment_status not null default 'pending',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.homeworks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  status public.homework_status not null default 'assigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  title text not null,
  kind text not null,
  url text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  send_at timestamptz not null,
  status public.notification_status not null default 'scheduled',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  requested_starts_at timestamptz not null,
  comment text,
  status public.reschedule_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_teacher_starts_idx on public.lessons(teacher_id,starts_at);
create index lessons_student_starts_idx on public.lessons(student_id,starts_at);
create index payments_student_due_idx on public.payments(student_id,due_at);
create index notifications_due_idx on public.notifications(status,send_at) where status='scheduled';
create index reschedule_teacher_status_idx on public.reschedule_requests(teacher_id,status);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now();return new;end;$$;

create trigger teachers_updated before update on public.teachers for each row execute function public.set_updated_at();
create trigger students_updated before update on public.students for each row execute function public.set_updated_at();
create trigger lessons_updated before update on public.lessons for each row execute function public.set_updated_at();
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();
create trigger homeworks_updated before update on public.homeworks for each row execute function public.set_updated_at();
create trigger reschedule_updated before update on public.reschedule_requests for each row execute function public.set_updated_at();

-- Generate lesson reminders once a lesson is created.
create or replace function public.enqueue_lesson_notifications() returns trigger language plpgsql security definer set search_path=public as $$
declare first_name text;
begin
  if new.student_id is null then return new; end if;
  select split_part(name,' ',1) into first_name from public.students where id=new.student_id;
  if new.reminder_24h and new.starts_at > now()+interval '24 hours' then
    insert into public.notifications(teacher_id,student_id,lesson_id,kind,title,message,send_at)
    values(new.teacher_id,new.student_id,new.id,'lesson_24h','Урок завтра',first_name||', завтра в '||to_char(new.starts_at at time zone 'Europe/Moscow','HH24:MI')||' у нас английский ✨',new.starts_at-interval '24 hours');
  end if;
  if new.reminder_2h and new.starts_at > now()+interval '2 hours' then
    insert into public.notifications(teacher_id,student_id,lesson_id,kind,title,message,send_at)
    values(new.teacher_id,new.student_id,new.id,'lesson_2h','Урок через 2 часа',first_name||', урок начнётся через 2 часа. Ссылка доступна в личном кабинете.',new.starts_at-interval '2 hours');
  end if;
  if new.reminder_15m and new.starts_at > now()+interval '15 minutes' then
    insert into public.notifications(teacher_id,student_id,lesson_id,kind,title,message,send_at)
    values(new.teacher_id,new.student_id,new.id,'lesson_15m','Начинаем через 15 минут',first_name||', начинаем через 15 минут. До встречи!',new.starts_at-interval '15 minutes');
  end if;
  return new;
end;$$;
create trigger lessons_enqueue_notifications after insert on public.lessons for each row execute function public.enqueue_lesson_notifications();

-- Mark due payments as overdue. This can be called by Supabase Cron.
create or replace function public.refresh_overdue_payments() returns void language sql security definer set search_path=public as $$
  update public.payments set status='overdue' where status='pending' and due_at < now();
$$;

-- RLS: browser users only see rows belonging to their teacher account.
alter table public.workspace_snapshots enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.student_access_tokens enable row level security;
alter table public.lessons enable row level security;
alter table public.payments enable row level security;
alter table public.homeworks enable row level security;
alter table public.materials enable row level security;
alter table public.notifications enable row level security;
alter table public.reschedule_requests enable row level security;

create policy "teacher reads own profile" on public.teachers for select to authenticated using (id=auth.uid());
create policy "teacher updates own profile" on public.teachers for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy "teacher manages students" on public.students for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages lessons" on public.lessons for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages payments" on public.payments for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages homeworks" on public.homeworks for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages materials" on public.materials for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages notifications" on public.notifications for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages requests" on public.reschedule_requests for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teacher manages access tokens" on public.student_access_tokens for all to authenticated using (exists(select 1 from public.students s where s.id=student_id and s.teacher_id=auth.uid())) with check (exists(select 1 from public.students s where s.id=student_id and s.teacher_id=auth.uid()));

-- No client policies are created for workspace_snapshots. It is available only through
-- service-role Edge Functions after Telegram initData validation.
-- No anon policies are created. Student data is returned only by the student-data Edge Function.
