const { fetchWithRetry } = require("./http");

const SI_API = "https://api.si.edu/openaccess/api/v1.0/search";

// SIL — каталог библиотеки (описания книг, а не музейных предметов), пропускаем
const EXCLUDED_UNITS = new Set(["SIL"]);

function getApiKey() {
  // Бесплатный личный ключ: https://api.data.gov/signup/
  // Без него используется общий DEMO_KEY с жёстким лимитом запросов
  return process.env.SMITHSONIAN_API_KEY || "DEMO_KEY";
}

function fetchSi(url) {
  return fetchWithRetry(url, {}, { context: "Smithsonian", timeoutMs: 15000 });
}

// Собирает описательный текст предмета из заметок музея (аналог статьи Wikipedia)
function extractDescription(notes) {
  return notes
    .filter((n) => /description|summary/i.test(n.label || ""))
    .map((n) => n.content)
    .filter(Boolean)
    .join("\n\n");
}

async function searchArtifacts(query, rows = 8) {
  // online_media_type:Images — только предметы с фото (отсекает и бо́льшую часть
  // библиотечных карточек без фотографий самого предмета)
  const q = encodeURIComponent(`${query} online_media_type:Images`);
  const url = `${SI_API}?q=${q}&api_key=${encodeURIComponent(getApiKey())}&rows=${rows}`;

  const res = await fetchSi(url);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Smithsonian API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.response?.rows || [];
}

function toArtifact(row) {
  if (EXCLUDED_UNITS.has(row.unitCode)) return null;

  const content = row.content || {};
  const notes = content.freetext?.notes || [];
  const text = extractDescription(notes);
  if (text.length < 200) return null; // недостаточно материала для факта

  const media = content.descriptiveNonRepeating?.online_media?.media?.[0];
  if (!media?.content) return null;

  return {
    title: row.title,
    text,
    imageUrl: `${media.content}&max=1200`,
    url: content.descriptiveNonRepeating?.guid || null,
  };
}

// Собирает пул предметов сразу из нескольких поисковых фраз, чтобы было
// из чего выбирать самый живой вариант, а не первый попавшийся
async function collectCandidates(searchTerms, shownTitles, { termsToTry = 3, rowsPerTerm = 8 } = {}) {
  const shuffled = [...searchTerms].sort(() => Math.random() - 0.5).slice(0, termsToTry);
  const pool = new Map(); // title -> artifact

  for (const term of shuffled) {
    const rows = await searchArtifacts(term, rowsPerTerm);
    for (const row of rows) {
      const artifact = toArtifact(row);
      if (artifact && !pool.has(artifact.title) && !shownTitles.includes(artifact.title)) {
        pool.set(artifact.title, artifact);
      }
    }
  }

  return pool;
}

// По списку англоязычных поисковых фраз находит музейный предмет,
// который ещё не показывали. chooseTitle — необязательный колбэк
// (title[]) => title[] для сортировки по "интересности" (claude.js)
async function findUnseenArtifact(searchTerms, shownTitles, { chooseTitle } = {}) {
  const pool = await collectCandidates(searchTerms, shownTitles);
  if (pool.size === 0) return null;

  const titles = [...pool.keys()];
  const ordered = chooseTitle ? await chooseTitle(titles) : titles;

  for (const title of ordered) {
    const artifact = pool.get(title);
    if (artifact) return artifact;
  }

  return null; // не нашли ничего нового
}

module.exports = { searchArtifacts, findUnseenArtifact };
