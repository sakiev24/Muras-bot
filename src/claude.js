const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function rewriteAsFact({ articleText, articleTitle, regionName, themeName, themeLens }) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Ограничиваем длину исходного текста, чтобы не тратить лишние токены
  const trimmedText = articleText.slice(0, 6000);

  const systemPrompt = `Ты пишешь короткие посты об истории для Telegram-канала, 
который читают не для учёбы, а для интереса — как что-то залипательное в ленте.

Тебе дают текст статьи из Wikipedia. Тема выпуска: "${themeName}" (${themeLens}).
Регион: ${regionName}.

СТРОГИЙ ЛИМИТ: 4-5 предложений. Не больше. Это самое важное правило.

Структура:
1. Первое предложение — крючок: неожиданный факт, парадокс, конкретная деталь 
   или вопрос, который сразу цепляет. НЕ начинай с определений вроде 
   "X — это..." или "X — важное событие в истории...".
2. Дальше 2-3 предложения по существу, с акцентом на тему "${themeName}".
3. Последнее предложение — почему это имеет значение или неожиданный поворот, 
   а не скучный обобщающий вывод типа "это определило облик страны".

Что важно:
- НЕ выдумывай факты, которых нет в исходном тексте.
- НЕ копируй предложения дословно — пересказывай своими словами.
- Пиши конкретно (цифры, имена, детали), а не общими фразами.
- Никакого канцелярита, никаких фраз вроде "колоссальные перемены", 
  "грандиозные испытания", "определил облик" — это штампы, избегай их.
- Максимум 1-2 эмодзи, не в каждом предложении.
- Ответь только текстом поста, без предисловий от себя.`;

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