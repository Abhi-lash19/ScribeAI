import Groq from "groq-sdk";
import { getRecentMessages } from "../db/messages.repo";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

type Intent =
  | "write"
  | "rephrase"
  | "summarize"
  | "explain"
  | "generic";

interface GenerateAIResponseInput {
  userInput: string;
  channelId: string;
}

function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();

  if (
    p.startsWith("write") ||
    p.includes("email") ||
    p.includes("post")
  ) {
    return "write";
  }

  if (
    p.startsWith("rephrase") ||
    p.includes("fix grammar") ||
    p.includes("make this")
  ) {
    return "rephrase";
  }

  if (p.startsWith("summarize") || p.includes("summary")) {
    return "summarize";
  }

  if (
    p.startsWith("what is") ||
    p.startsWith("define") ||
    p.startsWith("explain") ||
    p.includes("in simple terms")
  ) {
    return "explain";
  }

  return "generic";
}

function buildSystemPrompt(intent: Intent): string {
  switch (intent) {
    case "write":
      return `
You are a professional writing assistant.
Produce final, ready-to-use content.
Do not explain your reasoning.
Do not add extra commentary.
Sound confident, natural, and human.
`;

    case "rephrase":
      return `
Rewrite the text to improve clarity and tone.
Preserve the original meaning.
Return only the rewritten version.
`;

    case "summarize":
      return `
Summarize the content into clear bullet points.
Focus only on key ideas.
`;

    case "explain":
      return `
Explain in very simple terms.
Assume the user is non-technical.
Keep it short unless the user asks for detail.
`;

    default:
      return `
Be helpful, direct, and concise.
Avoid generic or textbook-style explanations.
`;
  }
}

function buildContextBlock(
  messages: { role: string; content: string }[]
): string {
  if (!messages.length) return "";

  return messages
    .map((m) =>
      m.role === "user"
        ? `User: ${m.content}`
        : `Assistant: ${m.content}`
    )
    .join("\n");
}

export async function generateAIResponse(
  input: GenerateAIResponseInput
): Promise<string> {
  const { userInput, channelId } = input;
  const intent = detectIntent(userInput);

  // Fetch recent context (safe – returns [] on failure)
  const recentMessages = await getRecentMessages(channelId);

  const contextBlock = buildContextBlock(recentMessages);

  const finalUserPrompt = contextBlock
    ? `Recent context:\n${contextBlock}\n\nUser input:\n${userInput}`
    : userInput;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: intent === "write" ? 0.65 : 0.35,
      max_tokens: intent === "write" ? 700 : 300,
      messages: [
        { role: "system", content: buildSystemPrompt(intent) },
        { role: "user", content: finalUserPrompt },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");

    return content;
  } catch (err) {
    console.error("[Groq] generation failed", err);
    throw err;
  }
}
