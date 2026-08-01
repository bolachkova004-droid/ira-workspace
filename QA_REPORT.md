# QA report — Ira Workspace v5.0

Проверено 1 августа 2026 года.

## Автоматические проверки

- 25 статических JavaScript-модулей успешно сгенерированы из TypeScript/TSX.
- Все сгенерированные JS-файлы прошли `node --check`.
- Проверены все относительные импорты: отсутствующих файлов нет.
- Все основные экраны вызваны в smoke-тесте с тестовым workspace:
  Home, Students, StudentProfile, Leads, Calendar, LessonRoom, Analytics,
  Settings, Ecosystem, Content, More, Reminders, StudentPortal.
- `main.js` и Error Boundary успешно импортируются.
- Все четыре Supabase Edge Functions прошли синтаксическую транспиляцию TypeScript.
- GitHub Actions workflow проверяет готовую папку `docs` без npm-сборки.

## Ограничение среды проверки

Полную npm-сборку выполнить не удалось: внутренний npm-registry среды не содержит пакеты React. Поэтому для GitHub Pages подготовлена и отдельно проверена статическая версия в папке `docs`, не требующая npm на стороне пользователя.

## Что проверяется после подключения внешних сервисов

После добавления личных секретов нужно отдельно проверить:

- Telegram webhook;
- Telegram ID преподавателя;
- Supabase Cron;
- реальную отправку сообщения ученику;
- обновление `docs/config.js` адресом Supabase.

Эти значения не могут быть безопасно добавлены в публичный архив заранее.
