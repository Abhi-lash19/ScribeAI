// backend/src/services/groqService.ts

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function generateAIResponse(
  prompt: string
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    temperature: 0.7,
    max_tokens: 600,
    messages: [
      {
        role: "system",
        content:
          "You are a professional AI writing assistant. Respond clearly, concisely, and professionally.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return (
    completion.choices[0]?.message?.content ||
    "Sorry, I couldn’t generate a response."
  );
}
