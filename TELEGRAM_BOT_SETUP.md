# Настройка Telegram-бота

Бот: `@ira_workspace_bot`

## 1. Main Mini App

В `@BotFather`:

`/mybots → @ira_workspace_bot → Bot Settings → Configure Mini App → Main Mini App`

Адрес:

```text
https://bolachkova004-droid.github.io/ira-workspace/
```

## 2. Кнопка меню

`Bot Settings → Menu Button → Configure menu button`

Текст:

```text
Открыть Ira Workspace
```

Адрес — тот же.

## 3. Webhook для сообщений и привязки студентов

После развёртывания `telegram-webhook` выполните запрос, заменив значения:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook",
    "secret_token":"<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates":["message"]
  }'
```

## 4. Как ученик привязывает Telegram

Для каждого ученика создаётся персональный токен. Бот получает ссылку вида:

```text
https://t.me/ira_workspace_bot?start=access_<TOKEN>
```

После нажатия бот:

1. проверяет токен;
2. сохраняет Telegram ID ученика;
3. показывает кнопку личного кабинета;
4. начинает отправлять уведомления.

## 5. Что отправляется автоматически

- напоминание за 24 часа;
- напоминание за 2 часа;
- при необходимости — за 15 минут;
- перенос или отмена урока;
- напоминание об оплате;
- окончание пакета;
- новое домашнее задание.

## Проверка webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Поле `last_error_message` должно быть пустым.
