const WIKI_API = "https://ru.wikipedia.org/w/api.php";

// Ищет несколько статей-кандидатов по поисковому запросу
async function searchArticles(query, limit = 5) {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&srlimit=${limit}&origin=*`;

  const res = await fetch(url);
  const data = await res.json();
  return (data.query?.search || []).map((r) => r.title);
}

// Забирает полный текст + картинку по названию статьи
async function getArticle(title) {
  const url =
    `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=extracts|pageimages&exintro=false&explaintext=true` +
    `&pithumbsize=800&format=json&origin=*`;

  const res = await fetch(url);
  const data = await res.json();
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
