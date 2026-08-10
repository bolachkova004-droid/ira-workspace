# Cloud setup — Rasmus Beta 8.0

Supabase и Telegram уже настраиваются владельцем проекта. Участникам фокус-группы **не нужны** Supabase URL, токены, пароли или OWNER_SETUP_CODE.

После загрузки релиза в GitHub:

1. Дождаться успешного GitHub Pages deploy.
2. Запустить `Actions → Deploy Rasmus backend → Run workflow`.
3. Открыть Rasmus владельцем и проверить свой существующий кабинет.
4. Отправить тестеру ссылку `https://t.me/ira_workspace_bot?start=beta`.
5. Тестер нажимает Start → «Открыть Rasmus» → проходит onboarding.

Backend определяет преподавателя по валидированному Telegram Mini App `initData` и использует его запись `teachers.id` для чтения/записи workspace.
