async function sendFact({ chatId, botToken, factText, imageUrl, sourceUrl, regionName, themeName }) {
  const header = `📜 ${regionName} · ${themeName}\n\n`;
  const footer = `\n\n🔗 Источник: ${sourceUrl}`;
  const fullText = header + factText + footer;

  if (imageUrl) {
    // Telegram caption limit ~1024 символа, если текст длиннее - шлём отдельно
    if (fullText.length <= 1024) {
      await sendPhoto(botToken, chatId, imageUrl, fullText);
    } else {
      await sendPhoto(botToken, chatId, imageUrl, header.trim());
      await sendMessage(botToken, chatId, factText + footer);
    }
  } else {
    await sendMessage(botToken, chatId, fullText);
  }
}

async function sendPhoto(botToken, chatId, photoUrl, caption) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("sendPhoto failed, falling back to text:", data.description);
    await sendMessage(botToken, chatId, caption);
  }
}

async function sendMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("sendMessage failed:", data.description);
    throw new Error(`Telegram error: ${data.description}`);
  }
}

module.exports = { sendFact };
