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

// Канал — в первую очередь про историю. Поп-культура — редкая приправа:
// исторический пост, в котором есть отсылка к фильму/книге/комиксу.
const CONTENT_TYPES = [
  { key: "region", weight: 75 },
  { key: "museum", weight: 20 },
  { key: "popculture", weight: 5 },
];

// Выбирает тип контента дня. Поп-культура никогда не выпадает два дня подряд.
function pickContentType(lastPick) {
  const pool =
    lastPick?.type === "popculture"
      ? CONTENT_TYPES.filter((t) => t.key !== "popculture")
      : CONTENT_TYPES;
  return weightedRandom(pool).key;
}

// Список поисковых фраз региона под тему (например, geoTerms для географии)
function termsFor(region, theme) {
  const terms = theme.termsKey && region[theme.termsKey];
  return terms?.length ? terms : region.searchTerms;
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
  termsFor,
  pickMuseumRegionAndTheme,
};
