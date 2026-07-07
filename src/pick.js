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

// Раз в 3-4 дня в среднем = вероятность ~27% на каждый день
const POP_CULTURE_PROBABILITY = 0.27;

function shouldPickPopCulture(lastPick) {
  // не подряд два дня, даже если рандом выпадет второй раз
  if (lastPick && lastPick.type === "popculture") return false;
  return Math.random() < POP_CULTURE_PROBABILITY;
}

function pickPopCultureTopic(topics, shownTitles) {
  const unseen = topics.filter((t) => !shownTitles.includes(t.title));
  const pool = unseen.length > 0 ? unseen : topics; // если всё показали - начинаем по новой
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  weightedRandom,
  pickRegionAndTheme,
  shouldPickPopCulture,
  pickPopCultureTopic,
};