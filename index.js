const { REGIONS, THEMES, POP_CULTURE_TOPICS } = require("./src/config");
const {
  pickRegionAndTheme,
  pickContentType,
  pickPopCultureTopic,
  pickMuseumRegionAndTheme,
} = require("./src/pick");
const { findUnseenArticle } = require("./src/wikipedia");
const { findUnseenArtifact } = require("./src/smithsonian");
const { rewriteAsFact, generatePopCultureFact, rewriteArtifactAsFact } = require("./src/claude");
const { sendFact } = require("./src/telegram");
const { loadHistory, saveHistory } = require("./src/history");

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID");
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Не задан GEMINI_API_KEY");
  }

  const history = loadHistory();
  const type = pickContentType(history.lastPick);

  if (type === "popculture") {
    await runPopCulture(history, { chatId, botToken });
  } else if (type === "museum") {
    await runMuseumArtifact(history, { chatId, botToken });
  } else {
    await runRegionTheme(history, { chatId, botToken });
  }
}

async function runPopCulture(history, { chatId, botToken }) {
  const topic = pickPopCultureTopic(POP_CULTURE_TOPICS, history.shownTitles);

  console.log(`Выбрано: поп-культура, тема="${topic.title}" (verified=${topic.verified})`);

  const factText = await generatePopCultureFact({
    topicTitle: topic.title,
    topicNote: topic.note,
    verified: topic.verified,
  });

  if (!factText) {
    throw new Error("Gemini не вернул текст факта (поп-культура)");
  }

  await sendFact({
    chatId,
    botToken,
    factText,
    imageUrl: null,
    sourceUrl: null,
    regionName: "Поп-культура и история",
    themeName: topic.title,
    unverified: !topic.verified,
  });

  console.log("Сообщение отправлено в Telegram");

  history.shownTitles.push(topic.title);
  history.lastPick = { type: "popculture", topic: topic.title };
  saveHistory(history);
}

async function runRegionTheme(history, { chatId, botToken }) {
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
    throw new Error("Gemini не вернул текст факта");
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

  history.shownTitles.push(article.title);
  history.lastPick = { type: "region", region: region.key, theme: theme.key };
  saveHistory(history);
}

async function runMuseumArtifact(history, { chatId, botToken }) {
  const { region, theme } = pickMuseumRegionAndTheme(REGIONS, THEMES, history.lastPick);

  console.log(`Выбрано: музей (Smithsonian), регион="${region.name}", тема="${theme.name}"`);

  const artifact = await findUnseenArtifact(region.smithsonianTerms, history.shownTitles);

  if (!artifact) {
    console.warn("Не нашли новый экспонат для этой пары региона/темы. Пропускаем сегодня.");
    return;
  }

  console.log(`Экспонат найден: "${artifact.title}"`);

  const factText = await rewriteArtifactAsFact({
    artifactText: artifact.text,
    artifactTitle: artifact.title,
    regionName: region.name,
    themeName: theme.name,
    themeLens: theme.lens,
  });

  if (!factText) {
    throw new Error("Gemini не вернул текст факта (музей)");
  }

  await sendFact({
    chatId,
    botToken,
    factText,
    imageUrl: artifact.imageUrl,
    sourceUrl: artifact.url,
    regionName: region.name,
    themeName: theme.name,
  });

  console.log("Сообщение отправлено в Telegram");

  history.shownTitles.push(artifact.title);
  history.lastPick = { type: "museum", region: region.key, theme: theme.key };
  saveHistory(history);
}

main().catch((err) => {
  console.error("Ошибка выполнения бота:", err);
  process.exit(1);
});
