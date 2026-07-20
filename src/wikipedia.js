const { fetchWithRetry } = require("./http");

const WIKI_API = "https://ru.wikipedia.org/w/api.php";

// Wikipedia требует осмысленный User-Agent, иначе иногда отдаёт ошибку/HTML вместо JSON
const FETCH_HEADERS = {
  "User-Agent": "history-fact-bot/1.0 (personal telegram bot; contact: none)",
  Accept: "application/json",
};

function fetchWiki(url) {
  return fetchWithRetry(url, { headers: FETCH_HEADERS }, { context: "Wikipedia", timeoutMs: 15000 });
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

  const res = await fetchWiki(url);
  const data = await safeJson(res, "search");
  return (data.query?.search || []).map((r) => r.title);
}

// Забирает полный текст + картинку по названию статьи
async function getArticle(title) {
  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=extracts|pageimages&exintro=false&explaintext=true` +
    `&pithumbsize=800&format=json&origin=*`;

  const res = await fetchWiki(url);
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

// Собирает пул кандидатов сразу из нескольких поисковых фраз — так среди
// кандидатов чаще попадаются не только первые попавшиеся "статьи-зонтики"
// (целая страна/эпоха/процесс), а есть из чего выбирать
async function collectCandidates(searchTerms, shownTitles, { termsToTry = 3, perTerm = 8 } = {}) {
  const shuffled = [...searchTerms].sort(() => Math.random() - 0.5).slice(0, termsToTry);
  const seen = new Set();
  const candidates = [];

  for (const term of shuffled) {
    const titles = await searchArticles(term, perTerm);
    for (const title of titles) {
      if (!seen.has(title) && !shownTitles.includes(title)) {
        seen.add(title);
        candidates.push(title);
      }
    }
  }

  return candidates;
}

// Основная функция: по списку поисковых фраз региона находит статью,
// которую ещё не показывали. chooseTitle — необязательный колбэк
// (title[]) => title[], который переупорядочивает кандидатов от самого
// многообещающего к наименее (см. claude.js#pickMostInteresting)
async function findUnseenArticle(searchTerms, shownTitles, { chooseTitle } = {}) {
  const candidates = await collectCandidates(searchTerms, shownTitles);
  if (candidates.length === 0) return null;

  const ordered = chooseTitle ? await chooseTitle(candidates) : candidates;

  // ограничиваем число попыток загрузки статьи, чтобы не устроить
  // десятки запросов к Wikipedia, если подряд попадутся заглушки
  for (const title of ordered.slice(0, 8)) {
    const article = await getArticle(title);
    if (article && article.text && article.text.length > 200) {
      return article;
    }
  }

  return null; // не нашли ничего нового
}

module.exports = { searchArticles, getArticle, findUnseenArticle };