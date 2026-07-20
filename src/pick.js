function weightedRandom(items) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return items[items.length - 1];
}

// Выбирает регион и тему, избегая повтора вчерашней пары
function pickRegionAndTheme(regions, themes, lastPick) {
  let attempt = 0;
  let region, theme;

  do {
    region = weightedRandom(regions);
    theme = weightedRandom(themes);
    attempt++;
  } while (
    lastPick &&
    lastPick.region === region.key &&
    lastPick.theme === theme.key &&
    attempt < 10
  );

  return { region, theme };
}

const CONTENT_TYPES = ["region", "popculture", "museum"];

// Выбирает тип контента дня: обычная статья по региону, поп-культура или
// музейный экспонат. Все три равновероятны и независимы день ото дня —
// раньше тут была защита от повтора popculture/museum два дня подряд,
// но она имела смысл только пока эти типы были редкими на фоне региона
// (60%). Теперь все типы равноправны, и повтор одного не более "аномален",
// чем повтор другого — специальный случай только портил бы равномерность.
function pickContentType() {
  return CONTENT_TYPES[Math.floor(Math.random() * CONTENT_TYPES.length)];
}

function pickPopCultureTopic(topics, shownTitles) {
  const unseen = topics.filter((t) => !shownTitles.includes(t.title));
  const pool = unseen.length > 0 ? unseen : topics; // если всё показали - начинаем по новой
  return pool[Math.floor(Math.random() * pool.length)];
}

// Музейные предметы Smithsonian есть смысл искать только для регионов,
// у которых заданы англоязычные поисковые фразы (smithsonianTerms) —
// см. комментарий в src/config.js про то, почему kg/ca туда не входят.
function pickMuseumRegionAndTheme(regions, themes, lastPick) {
  const eligible = regions.filter((r) => r.smithsonianTerms?.length);
  return pickRegionAndTheme(eligible, themes, lastPick);
}

module.exports = {
  weightedRandom,
  pickRegionAndTheme,
  pickContentType,
  pickPopCultureTopic,
  pickMuseumRegionAndTheme,
};
