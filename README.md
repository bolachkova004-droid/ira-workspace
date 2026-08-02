# Ira Workspace 7.3 — Cloud + Telegram

Рабочая версия 7.2 сохранена как визуальная основа. В 7.3 добавлена реальная серверная архитектура:

- Supabase cloud sync с локальным fallback;
- серверная проверка Telegram Mini App `initData`;
- личные UUID-ссылки кабинета ученика;
- привязка ученика к Telegram через `/start student_<token>`;
- команды бота `/schedule`, `/payment`, `/homework`;
- уведомления об уроке за 24 часа и за 1 час;
- уведомления о переносе и отмене;
- домашнее и оплата;
- режимы «Авто», «На проверку», «Выкл»;
- автоматический Cron каждые пять минут;
- GitHub Action для развёртывания backend.

Публикация интерфейса: GitHub Pages из `main /docs`.

Начать: [START_HERE.md](START_HERE.md).
