# QA — Ira Workspace 7.3

## Frontend

- встроенный JavaScript успешно прошёл `node --check`;
- Playwright открыл автономную версию без runtime errors;
- проверены переходы: Ученики, Календарь, Контент, Расмус, Настройки, карточка ученика;
- проверено наличие полей подключения облака;
- сохранён ключ localStorage версии 7.x, поэтому данные 7.2 не сбрасываются;
- приложение продолжает работать локально при недоступном backend.

## Backend

- все Edge Functions успешно прошли TypeScript transpile diagnostics;
- RLS включён на всех таблицах, публичные политики не создаются;
- server secret key используется только в Edge Functions;
- teacher API требует валидный Telegram Mini App initData;
- portal API использует отдельный UUID token;
- webhook защищён Telegram secret token;
- reminder worker защищён отдельным cron secret;
- уведомления имеют dedupe key, чтобы не отправляться повторно;
- платежи по умолчанию остаются в очереди «На проверку».

## Что невозможно проверить без аккаунта владельца

- фактический deploy в конкретный Supabase project;
- настоящий Bot Token;
- webhook Telegram;
- получение сообщения реальным учеником.

Для этих проверок в приложении добавлены кнопки «Настроить бота» и «Тест сообщения».
