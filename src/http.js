const DEFAULT_TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// fetch с таймаутом и retry при 429/5xx (до maxAttempts попыток).
// Сетевые ошибки/таймауты не ретраим: запрос мог долететь до сервера
// (например, Telegram уже мог отправить сообщение), повтор рискует задвоить эффект.
async function fetchWithRetry(
  url,
  options = {},
  { context = "запрос", maxAttempts = 3, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout(url, options, timeoutMs);
    } catch (err) {
      const reason = err.name === "AbortError" ? `таймаут ${timeoutMs}мс` : err.message;
      throw new Error(`${context}: сетевая ошибка (${reason})`);
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      const waitMs = attempt * 2000;
      console.warn(`${context}: статус ${res.status}, жду ${waitMs}мс и повторяю (попытка ${attempt})`);
      await sleep(waitMs);
      continue;
    }

    return res;
  }
}

module.exports = { fetchWithRetry };
