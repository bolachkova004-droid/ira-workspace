# QA report — Rasmus Beta 8.0.1 Secure

Локально перед сборкой проверено:

- JavaScript root `index.html` разбирается Node.js без синтаксических ошибок.
- Все семь TypeScript-модулей Edge Functions проходят `deno check` с Supabase JS 2.x.
- SQL 8.0.1 разбирается настоящим PostgreSQL 15 parser: 162 top-level statements.
- Миграция выполняется в чистой PostgreSQL-compatible базе со stub-схемами Supabase.
- Upgrade-тест v7 → v8 сохраняет два workspace, revisions, student links, notification events и reschedule requests; legacy portal token заменяется хэшем.
- Динамический RLS-тест подтверждает: владелец и тестер видят только свой workspace, cross-workspace update изменяет 0 строк, заблокированный участник видит 0 строк.
- Динамический reset/restore-тест подтверждает атомарный сброс, восстановление состояния и Telegram-привязок, запрет сброса основного кабинета и запрет прямой смены Telegram chat ID.
- 11/11 security-contract тестов проверяют отсутствие общего `start=beta`, наличие RLS, JWT auth, хэшированных invite token, закрытого storage bucket, ограниченных column grants и защитного snapshot reset.
- `index.html`, `docs/index.html` и `docs/404.html` идентичны; `health.json` содержит `8.0.1-beta.1`.
- Архивы проходят проверку целостности `unzip -t`.

Требует живого smoke-test после деплоя:

- реальный Telegram webhook и обмен проверенного `initData` на Auth session;
- сохранность текущего production workspace после применения миграции;
- доставка bot-сообщений и запуск cron в проекте Supabase;
- OAuth Google Calendar, если заданы Google credentials;
- синхронизация между двумя реальными устройствами;
- Telegram WebView на используемых версиях iOS/Android.

Не отправляйте приглашения фокус-группе, пока workflow и smoke-test владельца + одного тестового Telegram-аккаунта не завершились успешно.
