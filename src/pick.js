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

module.exports = { weightedRandom, pickRegionAndTheme };
