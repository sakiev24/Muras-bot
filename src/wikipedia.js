const WIKI_API = "https://ru.wikipedia.org/w/api.php";

// Wikipedia требует осмысленный User-Agent, иначе иногда отдаёт ошибку/HTML вместо JSON
const FETCH_HEADERS = {
  "User-Agent": "history-fact-bot/1.0 (personal telegram bot; contact: none)",
  Accept: "application/json",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch с retry: при 429 или 5xx ждёт и пробует ещё раз (до 3 попыток)
async function fetchWithRetry(url, attempt = 1) {
  const res = await fetch(url, { headers: FETCH_HEADERS });

  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const waitMs = attempt * 2000; // 2с, потом 4с
    console.warn(`Wikipedia вернула ${res.status}, жду ${waitMs}мс и повторяю (попытка ${attempt})`);
    await sleep(waitMs);
    return fetchWithRetry(url, attempt + 1);
  }

  return res;
}

// Безопасно парсит ответ как JSON, показывая понятную ошибку если пришёл не JSON
async function safeJson(res, context) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Wikipedia вернула не-JSON ответ (${context}), статус ${res.status}: ${text.slice(
        0,
        300
      )}`
    );
  }
}

// Ищет несколько статей-кандидатов по поисковому запросу
async function searchArticles(query, limit = 5) {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&srlimit=${limit}&origin=*`;

  const res = await fetchWithRetry(url);
  const data = await safeJson(res, "search");
  return (data.query?.search || []).map((r) => r.title);
}

// Забирает полный текст + картинку по названию статьи
async function getArticle(title) {
  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=extracts|pageimages&exintro=false&explaintext=true` +
    `&pithumbsize=800&format=json&origin=*`;

  const res = await fetchWithRetry(url);
  const data = await safeJson(res, "getArticle");
  const page = Object.values(data.query.pages)[0];

  if (!page || page.missing !== undefined) return null;

  return {
    title: page.title,
    text: page.extract,
    imageUrl: page.thumbnail?.source || null,
    url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(
      page.title.replace(/ /g, "_")
    )}`,
  };
}

// Основная функция: по списку поисковых фраз региона находит статью,
// которую ещё не показывали
async function findUnseenArticle(searchTerms, shownTitles) {
  // перемешиваем поисковые фразы, чтобы не всегда начинать с первой
  const shuffled = [...searchTerms].sort(() => Math.random() - 0.5);

  for (const term of shuffled) {
    const candidates = await searchArticles(term, 5);
    const unseen = candidates.filter((t) => !shownTitles.includes(t));

    if (unseen.length > 0) {
      const chosenTitle = unseen[Math.floor(Math.random() * unseen.length)];
      const article = await getArticle(chosenTitle);
      if (article && article.text && article.text.length > 200) {
        return article;
      }
    }
  }

  return null; // не нашли ничего нового
}

module.exports = { searchArticles, getArticle, findUnseenArticle };