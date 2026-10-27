const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "shown.json");
const MAX_HISTORY = 300; // не даём файлу расти бесконечно
const RECENT_LIMIT = 30; // столько последних статей не повторяем, даже если в них остались разделы

// shownTitles   — исчерпанные статьи и музейные экспонаты, больше не показываем
// usedSections  — { title: [раздел] } для статей, в которых ещё есть непоказанные разделы
// recentTitles  — последние статьи, чтобы одна тема не шла несколько дней подряд
function emptyHistory() {
  return { shownTitles: [], usedSections: {}, recentTitles: [], lastPick: null };
}

function loadHistory() {
  if (!fs.existsSync(DATA_PATH)) {
    return emptyHistory();
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  try {
    return { ...emptyHistory(), ...JSON.parse(raw) };
  } catch {
    return emptyHistory();
  }
}

// Запоминает показанный раздел статьи; когда разделов не осталось —
// статья уходит в shownTitles навсегда
function recordArticle(history, article) {
  history.recentTitles = history.recentTitles
    .filter((t) => t !== article.title)
    .concat(article.title)
    .slice(-RECENT_LIMIT);

  if (article.sectionsLeft === 0) {
    history.shownTitles.push(article.title);
    delete history.usedSections[article.title];
  } else {
    history.usedSections[article.title] = (history.usedSections[article.title] || []).concat(
      article.section
    );
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

module.exports = { loadHistory, saveHistory, recordArticle };
