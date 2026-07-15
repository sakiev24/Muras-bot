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
const POP_CULTURE_PROBABILITY = 0.22;
// Музейные экспонаты Smithsonian — примерно раз в 5-6 дней
const MUSEUM_PROBABILITY = 0.18;

// Выбирает тип контента дня: обычная статья по региону, поп-культура
// или музейный экспонат. Один и тот же "редкий" тип (popculture/museum)
// не должен выпадать два дня подряд — они и так нечастые, повтор выглядит
// как баг. Обычный региональный тип может повторяться (пары регион+тема
// внутри него и так не повторяются, см. pickRegionAndTheme).
function pickContentType(lastPick) {
  const lastType = lastPick?.type;
  let type;
  let attempt = 0;

  do {
    const r = Math.random();
    if (r < POP_CULTURE_PROBABILITY) type = "popculture";
    else if (r < POP_CULTURE_PROBABILITY + MUSEUM_PROBABILITY) type = "museum";
    else type = "region";
    attempt++;
  } while (type !== "region" && type === lastType && attempt < 10);

  return type;
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
