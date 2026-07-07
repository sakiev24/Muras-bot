const { REGIONS, THEMES } = require("./src/config");
const { pickRegionAndTheme } = require("./src/pick");
const { findUnseenArticle } = require("./src/wikipedia");
const { rewriteAsFact } = require("./src/claude");
const { sendFact } = require("./src/telegram");
const { loadHistory, saveHistory } = require("./src/history");

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID");
  }

  // Support both new `GEMINI_API_KEY` (Google Gemini) and legacy `API_KEY` env var.
  const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!API_KEY) {
    throw new Error("Не задан GEMINI_API_KEY или API_KEY");
  }

  const history = loadHistory();
  const { region, theme } = pickRegionAndTheme(REGIONS, THEMES, history.lastPick);

  console.log(`Выбрано: регион="${region.name}", тема="${theme.name}"`);

  const article = await findUnseenArticle(region.searchTerms, history.shownTitles);

  if (!article) {
    console.warn("Не нашли новую статью для этой пары региона/темы. Пропускаем сегодня.");
    return;
  }

  console.log(`Статья найдена: "${article.title}"`);

  const factText = await rewriteAsFact({
    articleText: article.text,
    articleTitle: article.title,
    regionName: region.name,
    themeName: theme.name,
    themeLens: theme.lens,
  });

  if (!factText) {
    throw new Error("Claude не вернул текст факта");
  }

  await sendFact({
    chatId,
    botToken,
    factText,
    imageUrl: article.imageUrl,
    sourceUrl: article.url,
    regionName: region.name,
    themeName: theme.name,
  });

  console.log("Сообщение отправлено в Telegram");

  // сохраняем историю
  history.shownTitles.push(article.title);
  history.lastPick = { region: region.key, theme: theme.key };
  saveHistory(history);
}

main().catch((err) => {
  console.error("Ошибка выполнения бота:", err);
  process.exit(1);
});