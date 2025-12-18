// backend/src/config.ts

import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",

  // Server
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean),


  // Stream Chat
  stream: {
    apiKey: requireEnv("STREAM_API_KEY"),
    apiSecret: requireEnv("STREAM_API_SECRET"),
  },

  // LLM providers
  openaiApiKey: process.env.OPENAI_API_KEY ?? null,
  groqApiKey: process.env.GROQ_API_KEY ?? null,

  // Tavily (optional, we allow it to be missing and just disable web search)
  tavilyApiKey: process.env.TAVILY_API_KEY ?? null,
};
