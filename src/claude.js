const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function rewriteAsFact({ articleText, articleTitle, regionName, themeName, themeLens }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  // Ограничиваем длину исходного текста, чтобы не тратить лишние токены
  const trimmedText = articleText.slice(0, 6000);

  const systemPrompt = `Ты — редактор телеграм-канала об истории. 
Тебе дают текст статьи из Wikipedia. Твоя задача — переписать его 
СВОИМИ СЛОВАМИ в увлекательный, но точный короткий пост (6-9 предложений).

Тема этого выпуска: "${themeName}" (${themeLens}).
Регион: ${regionName}.

Правила:
- Делай акцент именно на теме "${themeName}". Если в статье мало прямой 
  информации по этой теме — вытяни то, что относится к ней из контекста.
- НЕ выдумывай факты, которых нет в исходном тексте.
- НЕ копируй предложения дословно — только пересказ своими словами.
- Стиль живой, конкретный, без канцелярита и без вступлений вроде "Сегодня расскажем".
- В конце добавь короткую фразу (1 предложение) — почему это важно или 
  к чему это привело.
- Не используй markdown-заголовки, только обычный текст с эмодзи если уместно.
- Отвечай только текстом поста, без предисловий и пояснений от себя.`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Статья "${articleTitle}":\n\n${trimmedText}` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : null;
}

module.exports = { rewriteAsFact };