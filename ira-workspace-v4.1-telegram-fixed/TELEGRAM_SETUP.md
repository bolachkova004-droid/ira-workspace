# Настройка Ira Workspace в Telegram

## Сначала проверь сайт

После успешного GitHub Action открой:

`https://bolachkova004-droid.github.io/ira-workspace/`

Также можно проверить служебный файл:

`https://bolachkova004-droid.github.io/ira-workspace/health.json`

Если второй адрес показывает JSON со `status: ok`, опубликована именно новая сборка.

## Основное Mini App

1. Открой `@BotFather`.
2. Отправь `/mybots`.
3. Выбери `@ira_workspace_bot`.
4. Открой **Bot Settings → Configure Mini App → Enable Mini App**.
5. Вставь URL: `https://bolachkova004-droid.github.io/ira-workspace/`
6. Укажи название: `Ira Workspace`.
7. В **Configure Splash Screen** добавь иконку и выбери светлый фон `#FFF8FB`, тёмный `#171318`.

## Кнопка меню в чате

1. В настройках бота открой **Menu Button**.
2. Выбери изменение кнопки меню.
3. Текст: `Открыть Ira Workspace`.
4. URL: `https://bolachkova004-droid.github.io/ira-workspace/`

## Оформление бота

Рекомендуемые тексты:

**Description**
`Личное рабочее пространство преподавателя: ученики, уроки, заявки, контент и аналитика.`

**About**
`Ira Workspace — всё для работы преподавателя в одном месте.`

**Commands**
`start - открыть Ira Workspace`
`help - помощь по приложению`

Важно: BotFather настраивает запуск Mini App, но автоматические ответы на `/start` требуют отдельного серверного кода бота. Для открытия приложения достаточно Main Mini App и Menu Button.
