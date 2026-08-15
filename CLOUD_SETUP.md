# Cloud setup — Rasmus Beta 8.1.0

Участникам фокус-группы не нужны URL Supabase, ключи, пароли или технические коды. Всё ниже настраивает только владелец проекта.

## Обязательные GitHub Actions secrets

| Secret | Значение |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal access token Supabase для CLI |
| `SUPABASE_PROJECT_ID` | Project ref; для текущей сборки — `trpnamqmuiwrleapxqlk` |
| `SUPABASE_DB_PASSWORD` | Пароль Postgres проекта |
| `TELEGRAM_BOT_TOKEN` | Токен `@ira_workspace_bot` от BotFather |
| `OWNER_TELEGRAM_ID` | Точный числовой Telegram user ID владельца; не username |
| `TELEGRAM_WEBHOOK_SECRET` | Случайная hex-строка для проверки webhook |
| `CRON_SECRET` | Отдельная случайная строка для worker |
| `DEPLOY_SECRET` | Отдельная случайная строка для deploy-only setup |
| `TOKEN_ENCRYPTION_KEY` | 32 случайных байта в hex (64 символа) для AES-GCM |

Сгенерировать четыре независимых секрета можно командой `openssl rand -hex 32`, запуская её заново для каждого значения. Не используйте один секрет в нескольких полях.

Для существующего проекта `OWNER_TELEGRAM_ID` можно сверить в Supabase SQL Editor:

```sql
select telegram_id, name, created_at
from public.teachers
order by created_at;
```

Значение обязательно: миграция и auth-функция никогда не угадывают администратора по порядку строк.

## Опционально: Google Calendar

Добавьте `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` одной OAuth 2.0 Web application. В Google Cloud Console укажите точный redirect URI:

```text
https://trpnamqmuiwrleapxqlk.supabase.co/functions/v1/google-oauth-callback
```

Если Google-секреты не заданы, остальная часть Rasmus работает, а кнопка подключения календаря показывает понятное сообщение.

## Деплой

1. Загрузите файлы в GitHub и дождитесь Pages deployment.
2. Запустите `Actions → Deploy Rasmus backend → Run workflow`.
3. Workflow связывает проект, применяет все миграции, сохраняет серверные секреты, разворачивает шесть функций, настраивает Telegram webhook и пяти-минутный cron.
4. Откройте Rasmus аккаунтом из `OWNER_TELEGRAM_ID` и проверьте данные.
5. Создайте персональное одноразовое приглашение для каждого тестера внутри приложения. Если его кабинет существовал до миграции, приглашение откроет сохранённый кабинет, а не создаст новый.

При ошибке workflow не отправляйте приглашения. Сначала сохраните полный лог шага, который завершился красным, и исправьте причину.
