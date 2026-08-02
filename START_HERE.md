# Начать здесь — Ira Workspace v6

## Сейчас

Загрузите содержимое этой папки в GitHub поверх текущего проекта. В репозитории на верхнем уровне должны быть видны `src`, `docs`, `public`, `supabase`, `package.json` и `index.html`.

В GitHub Pages оставьте:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

Проверка:

```text
https://bolachkova004-droid.github.io/ira-workspace/health.json
```

После публикации откройте:

```text
https://bolachkova004-droid.github.io/ira-workspace/
```

## Telegram

В `@BotFather` у `@ira_workspace_bot` укажите этот же адрес в двух местах:

- Main Mini App
- Menu Button

## Реальные уведомления студентам

Они включатся только после настройки Supabase. Это сделано специально: Bot Token нельзя безопасно хранить в публичном репозитории.

Откройте `SUPABASE_SETUP.md` и выполните шаги один раз. После этого:

- уроки и переносы смогут уходить автоматически;
- оплаты могут сначала попадать «На проверку»;
- ученик привяжет Telegram через персональную ссылку;
- Cron будет отправлять только одобренные или автоматические сообщения.
