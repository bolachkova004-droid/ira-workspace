# QA report — Rasmus Beta 8.0.0

Проверено локально перед сборкой архива:

- JavaScript `docs/index.html`, `docs/404.html`, root `index.html`: `node --check` — OK.
- TypeScript Edge Functions: синтаксический разбор через TypeScript `transpileModule` — OK.
- `docs/index.html` и `docs/404.html` синхронизированы.
- Версия `8.0.0` записана в `health.json`.
- Workflow использует deploy `--project-ref` без проблемного `supabase link`.
- Новая миграция базы не требуется.
- Проверены маршруты: teacher status/pull/push фильтруются по `teacher.id`, полученному из проверенного Telegram initData.
- Новые преподаватели получают пустой `workspace_states`.
- Существующие строки `teachers/workspace_states` не очищаются при деплое.
- В интерфейсе добавлены перенос, отмена, sticky actions, 16px form controls и onboarding.

Не может быть проверено локально без живого Telegram/Supabase:

- реальная доставка webhook-сообщений;
- поведение Telegram WebView на конкретной версии iOS/Android;
- синхронизация между двумя реальными устройствами;
- фактическая запись в живой Supabase после деплоя.

После установки рекомендуется провести smoke-test владельцем и одним тестовым Telegram-аккаунтом перед отправкой всей фокус-группе.
