const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "shown.json");
const MAX_HISTORY = 300; // не даём файлу расти бесконечно

function loadHistory() {
  if (!fs.existsSync(DATA_PATH)) {
    return { shownTitles: [], lastPick: null };
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return { shownTitles: [], lastPick: null };
  }
}

function saveHistory(history) {
  // обрезаем старую историю, чтобы файл не рос вечно
  if (history.shownTitles.length > MAX_HISTORY) {
    history.shownTitles = history.shownTitles.slice(-MAX_HISTORY);
  }
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(history, null, 2));
}

module.exports = { loadHistory, saveHistory };
