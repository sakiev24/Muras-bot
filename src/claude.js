const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function rewriteAsFact({ articleText, articleTitle, regionName, themeName, themeLens }) {
  const apiKey = process.env.API_KEY;

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

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Статья "${articleTitle}":\n\n${trimmedText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text.trim() : null;
}

module.exports = { rewriteAsFact };
