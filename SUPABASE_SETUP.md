# Подключение Supabase — Ira Workspace v5

Эта часть нужна один раз, чтобы данные хранились не только на одном устройстве, а уведомления отправлялись автоматически.

## 1. Создать проект

1. Откройте Supabase Dashboard и создайте новый проект.
2. В разделе **SQL Editor** откройте файл:
   `supabase/migrations/202608010001_ira_workspace_v5.sql`
3. Скопируйте его целиком и нажмите **Run**.

Схема создаёт учеников, уроки, оплаты, домашнее, личные ссылки, запросы переноса и очередь уведомлений. На всех публичных таблицах включён RLS.

## 2. Добавить переменные проекта

Скопируйте `.env.example` в `.env.local` и заполните только переменные `VITE_*`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_BOT_USERNAME=ira_workspace_bot
VITE_APP_URL=https://bolachkova004-droid.github.io/ira-workspace/
```

`SUPABASE_SERVICE_ROLE_KEY` и `TELEGRAM_BOT_TOKEN` нельзя добавлять в Vite или GitHub Pages. Они должны храниться только в Supabase Secrets.

## 3. Установить Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Добавить секреты Edge Functions

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="TOKEN_ИЗ_BOTFATHER"
supabase secrets set TELEGRAM_WEBHOOK_SECRET="ДЛИННАЯ_СЛУЧАЙНАЯ_СТРОКА"
supabase secrets set TEACHER_TELEGRAM_ID="ВАШ_ЧИСЛОВОЙ_TELEGRAM_ID"
supabase secrets set PUBLIC_APP_URL="https://bolachkova004-droid.github.io/ira-workspace/"
supabase secrets set CRON_SECRET="ЕЩЁ_ОДНА_ДЛИННАЯ_СТРОКА"
```

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` доступны функциям Supabase автоматически.

## 5. Развернуть функции

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy process-notifications --no-verify-jwt
supabase functions deploy student-data --no-verify-jwt
supabase functions deploy teacher-workspace --no-verify-jwt
```


## 5.1. Включить Supabase в статической версии

Откройте файл `docs/config.js` и вставьте адрес проекта:

```js
window.__IRA_CONFIG__ = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  BOT_USERNAME: "ira_workspace_bot",
  APP_URL: "https://bolachkova004-droid.github.io/ira-workspace/"
};
```

То же значение внесите в `public/config.js`, чтобы оно не потерялось при будущей сборке. После коммита откройте Mini App именно внутри Telegram: сервер проверит `Telegram.WebApp.initData`, создаст облачный снимок и включит синхронизацию.

## 6. Настроить расписание уведомлений

В Supabase откройте **Integrations → Cron → Create job**.

Создайте задачу раз в минуту с HTTP POST на:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications
```

Добавьте заголовок:

```text
x-cron-secret: ВАШ_CRON_SECRET
```

Также создайте SQL-задачу раз в час:

```sql
select public.refresh_overdue_payments();
```

## 7. Проверка

1. У ученика должен быть указан `telegram_id`.
2. В таблице `notifications` создайте тестовую запись со `status = scheduled` и `send_at = now()`.
3. Запустите Cron job вручную.
4. В Telegram должно прийти сообщение, а статус измениться на `sent`.

## Безопасность

- Не публикуйте Bot Token и Service Role Key.
- Не отключайте RLS.
- Студентский доступ идёт через Edge Function; прямого анонимного доступа к таблицам нет.
