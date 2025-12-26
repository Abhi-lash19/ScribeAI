// backend/src/services/groqService.ts

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function generateAIResponse(
  prompt: string
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
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

    const content =
      completion?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Groq returned empty response");
    }

    return content;
  } catch (err) {
    console.error("[Groq] generation failed", err);
    throw err; // MUST throw so webhook catch works correctly
  }
}
