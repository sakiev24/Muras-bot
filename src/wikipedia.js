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

const INTRO = "Введение";
// Служебные разделы, из которых факта не сделать
const SKIP_SECTION =
  /^(См\. также|Примечания|Комментарии|Литература|Ссылки|Источники|Библиография|Галерея)$/i;
// Заголовки разделов и подразделов в explaintext выглядят как "== X ==" / "=== X ==="
const SECTION_HEADING = /^(={2,3})\s*([^=].*?)\s*\1$/;
const MIN_SECTION_LENGTH = 200;

// Режет статью на разделы. Каждый раздел — отдельный источник факта,
// поэтому большую тему ("Киргизская ССР") можно показывать много раз,
// каждый раз с другой стороны
function splitSections(text) {
  const sections = [];
  let current = { name: INTRO, lines: [] };
  for (const line of text.split("\n")) {
    const heading = line.match(SECTION_HEADING);
    if (heading) {
      sections.push(current);
      current = { name: heading[2], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  return sections
    .map((s) => ({ name: s.name, text: s.lines.join("\n").trim() }))
    .filter((s) => !SKIP_SECTION.test(s.name) && s.text.length >= MIN_SECTION_LENGTH);
}

// Забирает полный текст (по разделам) + картинку по названию статьи.
// Важно: exintro нельзя передавать вовсе — MediaWiki считает булев параметр
// включённым при любом значении, и exintro=false отдавал только введение
async function getArticle(title) {
  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=extracts|pageimages&explaintext=true` +
    `&pithumbsize=800&format=json&origin=*`;

  const res = await fetchWiki(url);
  const data = await safeJson(res, "getArticle");
  const page = Object.values(data.query.pages)[0];

  if (!page || page.missing !== undefined || !page.extract) return null;

  return {
    title: page.title,
    sections: splitSections(page.extract),
    imageUrl: page.thumbnail?.source || (await findArticleImage(page.title)),
    url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(
      page.title.replace(/ /g, "_")
    )}`,
  };
}

// У многих статей нет "главной" картинки (pageimages), хотя в тексте есть
// карты, фото и гравюры — а для истории и географии картинка очень важна.
// REST media-list отдаёт картинки в порядке появления в статье; showInGallery
// отсекает иконки навигационных шаблонов. Ошибка здесь не должна ронять пост.
async function findArticleImage(title) {
  try {
    const url = `https://ru.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(
      title.replace(/ /g, "_")
    )}`;
    const res = await fetchWiki(url);
    if (!res.ok) return null;
    const data = await res.json();
    const image = (data.items || []).find(
      (i) => i.type === "image" && i.showInGallery && i.srcset?.length
    );
    if (!image) return null;
    const src = image.srcset[image.srcset.length - 1].src;
    return src.startsWith("//") ? `https:${src}` : src;
  } catch (err) {
    console.warn(`Не удалось найти картинку для "${title}":`, err.message);
    return null;
  }
}

// Статьи о современных произведениях, людях шоу-бизнеса и т.п. — поиск по
// "Согдиана" или "Манас" иногда приводит к певице или аэропорту
const OFF_TOPIC_TITLE =
  /\((значения|фильм[^)]*|телесериал[^)]*|сериал[^)]*|мультфильм[^)]*|певица|певец|рэпер|группа|альбом|песня|сингл|игра|компьютерная игра|аэропорт|футбольный клуб|телепередача)\)/i;

// Собирает пул кандидатов сразу из нескольких поисковых фраз — так среди
// кандидатов чаще попадаются не только первые попавшиеся "статьи-зонтики"
// (целая страна/эпоха/процесс), а есть из чего выбирать
async function collectCandidates(searchTerms, excludeTitles, { termsToTry = 3, perTerm = 8 } = {}) {
  const shuffled = [...searchTerms].sort(() => Math.random() - 0.5).slice(0, termsToTry);
  const seen = new Set();
  const candidates = [];

  for (const term of shuffled) {
    const titles = await searchArticles(term, perTerm);
    for (const title of titles) {
      if (!seen.has(title) && !excludeTitles.includes(title) && !OFF_TOPIC_TITLE.test(title)) {
        seen.add(title);
        candidates.push(title);
      }
    }
  }

  return candidates;
}

// Основная функция: по списку поисковых фраз региона находит статью
// с ещё не показанным разделом. excludeTitles — статьи, которые сейчас
// брать нельзя (исчерпаны или недавно были), usedSections — { title: [раздел] }.
// chooseTitle — необязательный колбэк (title[]) => title[], который
// переупорядочивает кандидатов от самого многообещающего к наименее
// (см. claude.js#pickMostInteresting)
async function findUnseenArticle(searchTerms, { excludeTitles = [], usedSections = {}, chooseTitle } = {}) {
  const candidates = await collectCandidates(searchTerms, excludeTitles);
  if (candidates.length === 0) return null;

  const ordered = chooseTitle ? await chooseTitle(candidates) : candidates;

  // ограничиваем число попыток загрузки статьи, чтобы не устроить
  // десятки запросов к Wikipedia, если подряд попадутся заглушки
  for (const title of ordered.slice(0, 8)) {
    const article = await getArticle(title);
    if (!article) continue;

    const used = usedSections[article.title] || [];
    const fresh = article.sections.filter((s) => !used.includes(s.name));
    if (fresh.length === 0) continue;

    // сначала введение (самое общее), дальше — случайный раздел
    const section =
      fresh[0].name === INTRO ? fresh[0] : fresh[Math.floor(Math.random() * fresh.length)];
    const anchor = section.name === INTRO ? "" : `#${encodeURIComponent(section.name.replace(/ /g, "_"))}`;

    return {
      title: article.title,
      text: section.text,
      section: section.name,
      sectionsLeft: fresh.length - 1,
      imageUrl: article.imageUrl,
      url: article.url + anchor,
    };
  }

  return null; // не нашли ничего нового
}

module.exports = { searchArticles, getArticle, findUnseenArticle };