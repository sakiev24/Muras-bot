const { fetchWithRetry } = require("./http");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendFact({ chatId, botToken, factText, imageUrl, sourceUrl, regionName, themeName, unverified }) {
  const header = `📜 <b>${escapeHtml(regionName)} · ${escapeHtml(themeName)}</b>\n\n`;
  const body = escapeHtml(factText);
  const unverifiedNote = unverified
    ? `\n\n<i>💭 Это распространённая интерпретация, а не подтверждённый факт.</i>`
    : "";
  const footer = sourceUrl
    ? `\n\n🔗 <a href="${escapeHtml(sourceUrl)}">Источник</a>`
    : unverifiedNote;
  const fullText = header + body + (sourceUrl ? footer : unverifiedNote);

  if (imageUrl) {
    // Telegram caption limit ~1024 символа, если текст длиннее - шлём отдельно
    if (fullText.length <= 1024) {
      await sendPhoto(botToken, chatId, imageUrl, fullText);
    } else {
      await sendPhoto(botToken, chatId, imageUrl, header.trim());
      // preview выключен: картинка уже отправлена отдельным сообщением выше
      await sendMessage(botToken, chatId, body + (sourceUrl ? footer : unverifiedNote), {
        disableWebPagePreview: true,
      });
    }
  } else {
    await sendMessage(botToken, chatId, fullText);
  }
}

async function sendPhoto(botToken, chatId, photoUrl, caption) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "HTML",
      }),
    },
    { context: "Telegram sendPhoto", timeoutMs: 15000 }
  );
  const data = await res.json();
  if (!data.ok) {
    console.error("sendPhoto failed, falling back to text:", data.description);
    await sendMessage(botToken, chatId, caption);
  }
}

async function sendMessage(botToken, chatId, text, { disableWebPagePreview = false } = {}) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: disableWebPagePreview,
      }),
    },
    { context: "Telegram sendMessage", timeoutMs: 15000 }
  );
  const data = await res.json();
  if (!data.ok) {
    console.error("sendMessage failed:", data.description);
    throw new Error(`Telegram error: ${data.description}`);
  }
}

module.exports = { sendFact };
