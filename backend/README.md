# Backend Rasmus 8.1.0

Supabase Edge Functions:

- `telegram-auth` — проверка Telegram Mini App `initData`, одноразовый beta invite и выдача Supabase Auth session;
- `workspace-api` — JWT + RLS API кабинета, приглашения, портал, feedback, reset и Google Calendar;
- `telegram-webhook` — закрытый вход преподавателей, привязка учеников и команды бота;
- `process-notifications` — автоотчёты через 24 часа, генерация, блокировка, доставка и повторные попытки уведомлений;
- `google-oauth-callback` — одноразовый OAuth state и зашифрованное хранение Google refresh token;
- `project-setup` — deploy-secret endpoint для webhook, команд бота и cron.

Рекомендуемый способ установки — ручной GitHub Actions workflow из `.github/workflows/deploy-supabase.yml`.
