# Ira Workspace backend

Supabase backend for Ira Workspace 7.3.

- `supabase/migrations` — database schema and secure Cron installer;
- `supabase/functions/workspace-api` — authenticated teacher sync, portal and review queue;
- `supabase/functions/telegram-webhook` — student linking and bot commands;
- `supabase/functions/process-notifications` — scheduled reminder generator and sender.

Teacher actions validate Telegram Mini App `initData` on the server. Public student access uses an unguessable UUID portal token. Database tables have RLS enabled and no public policies.
