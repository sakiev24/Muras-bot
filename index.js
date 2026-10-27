const { REGIONS, THEMES } = require("./src/config");
const {
  pickRegionAndTheme,
  pickContentType,
  pickMuseumRegionAndTheme,
  termsFor,
} = require("./src/pick");
const { findUnseenArticle } = require("./src/wikipedia");
const { findUnseenArtifact } = require("./src/smithsonian");
const {
  rewriteAsFact,
  rewriteWithPopCultureLink,
  rewriteArtifactAsFact,
  pickMostInteresting,
} = require("./src/claude");
const { sendFact } = require("./src/telegram");
const { loadHistory, saveHistory, recordArticle } = require("./src/history");

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
  const ctx = { chatId, botToken };

  let posted;
  if (type === "museum") {
    posted = await runMuseumArtifact(history, ctx);
  } else {
    posted = await runRegionTheme(history, ctx, { popCulture: type === "popculture" });
  }

  // Основной выбор мог не найти материала (редко, но возможно) — вместо
  // тишины в канале пробуем обычный исторический пост ещё раз (новая пара
  // региона/темы выпадет случайно)
  if (!posted) {
    console.warn("Основной тип контента ничего не нашёл, пробуем обычный исторический пост.");
    posted = await runRegionTheme(history, ctx);
  }

  if (!posted) {
    console.warn("Не удалось подготовить пост ни одним из способов сегодня.");
  }
}

// popCulture: true — тот же исторический пост, но Gemini пробует добавить
// отсылку к фильму/книге/комиксу, реально связанному с темой статьи.
// Если надёжной связи нет — выходит обычный исторический пост.
async function runRegionTheme(history, { chatId, botToken }, { popCulture = false } = {}) {
  const { region, theme } = pickRegionAndTheme(REGIONS, THEMES, history.lastPick);

  console.log(`Выбрано: регион="${region.name}", тема="${theme.name}", поп-культура=${popCulture}`);

  const article = await findUnseenArticle(termsFor(region, theme), {
    excludeTitles: [...history.shownTitles, ...history.recentTitles],
    usedSections: history.usedSections,
    chooseTitle: (candidates) =>
      pickMostInteresting(candidates, { regionName: region.name, themeName: theme.name }),
  });

  if (!article) {
    console.warn("Не нашли новую статью для этой пары региона/темы. Пропускаем сегодня.");
    return false;
  }

  console.log(`Статья найдена: "${article.title}", раздел "${article.section}"`);

  const factArgs = {
    articleText: article.text,
    articleTitle: article.title,
    regionName: region.name,
    themeName: theme.name,
    themeLens: theme.lens,
  };

  let factText = popCulture ? await rewriteWithPopCultureLink(factArgs) : null;
  const withPopCulture = Boolean(factText);
  if (popCulture && !withPopCulture) {
    console.log("Надёжной связи с поп-культурой нет — публикуем обычный исторический пост.");
  }
  if (!factText) {
    factText = await rewriteAsFact(factArgs);
  }

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
    themeName: withPopCulture ? `${theme.name} · Поп-культура` : theme.name,
  });

  console.log("Сообщение отправлено в Telegram");

  recordArticle(history, article);
  history.lastPick = {
    type: withPopCulture ? "popculture" : "region",
    region: region.key,
    theme: theme.key,
  };
  saveHistory(history);
  return true;
}

async function runMuseumArtifact(history, { chatId, botToken }) {
  const { region, theme } = pickMuseumRegionAndTheme(REGIONS, THEMES, history.lastPick);

  console.log(`Выбрано: музей (Smithsonian), регион="${region.name}", тема="${theme.name}"`);

  const artifact = await findUnseenArtifact(region.smithsonianTerms, history.shownTitles, {
    chooseTitle: (candidates) =>
      pickMostInteresting(candidates, { regionName: region.name, themeName: theme.name }),
  });

  if (!artifact) {
    console.warn("Не нашли новый экспонат для этой пары региона/темы. Пропускаем сегодня.");
    return false;
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
  return true;
}

main().catch((err) => {
  console.error("Ошибка выполнения бота:", err);
  process.exit(1);
});
