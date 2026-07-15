# history-bot

Telegram-бот, который раз в день публикует короткий исторический факт.

Как это работает:

1. Выбирается регион и тема (`src/config.js`, `src/pick.js`) — либо, с вероятностью
   ~27%, тема из поп-культуры вместо региона.
2. Для региона/темы находится ещё не показанная статья в русской Wikipedia
   (`src/wikipedia.js`).
3. Статья переписывается в короткий пост (2-3 предложения) через Gemini API
   (`src/claude.js`).
4. Пост отправляется в Telegram-канал/чат (`src/telegram.js`), картинка статьи
   прикладывается, если есть.
5. Показанные заголовки сохраняются в `data/shown.json`, чтобы не повторяться
   (`src/history.js`).

Запускается ежедневно через GitHub Actions (`.github/workflows/daily.yml`),
после отправки коммитит обновлённый `data/shown.json` обратно в репозиторий.

## Запуск

Нужен Node.js 20+.

```bash
npm install
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... GEMINI_API_KEY=... npm start
```

### Переменные окружения

| Переменная            | Назначение                                      |
| ---------------------- | ------------------------------------------------ |
| `TELEGRAM_BOT_TOKEN`   | Токен бота от @BotFather                         |
| `TELEGRAM_CHAT_ID`     | ID чата/канала, куда публикуются посты           |
| `GEMINI_API_KEY`       | Ключ Gemini API (генерация текста поста)         |

В GitHub Actions эти переменные берутся из секретов репозитория.

## Структура

```
index.js            — точка входа, оркестрация шагов
src/config.js        — регионы, темы и темы поп-культуры с весами
src/pick.js           — взвешенный случайный выбор региона/темы/поп-культуры
src/wikipedia.js      — поиск и загрузка статей из Wikipedia
src/claude.js         — переписывание статьи в пост через Gemini API
src/telegram.js       — отправка сообщения/фото в Telegram
src/history.js        — хранение уже показанных заголовков (data/shown.json)
src/http.js           — общий fetch с таймаутом и retry на 429/5xx
```

## Локальный запуск вручную

Через workflow_dispatch можно запустить бота в GitHub Actions вручную —
вкладка Actions → Daily History Fact → Run workflow.
