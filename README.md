# History Fact Bot

Телеграм-бот, который раз в день присылает исторический факт: 
случайно выбирает регион (Кыргызстан, Центральная Азия, СНГ, Запад, Азия, 
Южная Америка, Африка) и тему (политика, экономика, общество, культура, 
быт, идеи, причины/следствия, философия), находит подходящую статью 
в Wikipedia, переписывает её через Claude API и отправляет в Telegram 
вместе с картинкой (если есть).

## Настройка

### 1. Создать Telegram-бота

1. Написать [@BotFather](https://t.me/BotFather) в Telegram
2. Команда `/newbot`, следовать инструкциям
3. Сохранить полученный токен — это `TELEGRAM_BOT_TOKEN`

### 2. Узнать свой chat_id

1. Написать что-нибудь своему новому боту (любое сообщение)
2. Открыть в браузере: 
   `https://api.telegram.org/bot<ТВОЙ_ТОКЕН>/getUpdates`
3. В ответе найти `"chat":{"id": ...}` — это число и есть `TELEGRAM_CHAT_ID`

### 3. Получить ключ Anthropic API

1. Зарегистрироваться на [console.anthropic.com](https://console.anthropic.com)
2. Создать API-ключ, пополнить баланс (даже пары долларов хватит очень надолго)
3. Сохранить ключ — это `ANTHROPIC_API_KEY`

### 4. Залить проект в GitHub

```bash
cd history-bot
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<твой-юзернейм>/history-bot.git
git push -u origin main
```

### 5. Добавить секреты в GitHub

В репозитории: `Settings → Secrets and variables → Actions → New repository secret`

Добавить три секрета:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ANTHROPIC_API_KEY`

### 6. Проверить

Во вкладке `Actions` репозитория запустить workflow вручную 
(`Daily History Fact → Run workflow`), чтобы проверить, что всё работает, 
не дожидаясь утра.

## Настройка времени отправки

В файле `.github/workflows/daily.yml` строка:
```yaml
- cron: "0 1 * * *"
```
Время указано в UTC. Для Бишкека (UTC+6) время `01:00 UTC` = `07:00` по Бишкеку.
Если хочешь другое время — пересчитай и поменяй эту строку 
(например, `08:00` по Бишкеку = `2:00 UTC` → `"0 2 * * *"`).

## Кастомизация

- **Веса регионов/тем** — файл `src/config.js`, поле `weight` у каждого элемента
- **Поисковые темы для региона** — там же, поле `searchTerms`
- **Стиль текста факта** — промпт в `src/claude.js`
- **Модель Claude** — сейчас используется Haiku (самая дешёвая), 
  можно поменять на Sonnet в `src/claude.js` если захочется более 
  качественных текстов (но и дороже)
