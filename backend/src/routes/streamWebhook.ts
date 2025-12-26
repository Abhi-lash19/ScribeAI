import { Request, Response } from "express";
import crypto from "crypto";
import { isRateLimited } from "../middleware/rateLimiter";
import { generateAIResponse } from "../services/groqService";
import { sendAIMessage } from "../services/streamService";

/**
 * Prevent duplicate processing (message.id → timestamp)
 */
const processedMessages = new Map<string, number>();

const LOOP_TTL_MS = 60_000;
const MAX_CACHE_SIZE = 1000;

function cleanupProcessedMessages() {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > LOOP_TTL_MS) {
      processedMessages.delete(id);
    }
  }
}

/**
 * Verify Stream webhook signature
 */
function verifyStreamSignature(req: Request): boolean {
  const signature = req.header("X-Signature");
  const timestamp = req.header("X-Timestamp");

  if (!signature || !timestamp) return false;

  const body = JSON.stringify(req.body);
  const secret = process.env.STREAM_API_SECRET!;

  const payload = `${timestamp}.${body}`;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
}

/**
 * Stream webhook middleware
 */
export function streamWebhook() {
  return async function handler(req: Request, res: Response) {
    // ---- Security ----
    if (!verifyStreamSignature(req)) {
      console.warn("❌ Invalid Stream webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;

    // ---- Only handle new messages ----
    if (event.type !== "message.new") {
      return res.json({ ok: true });
    }

    const message = event.message;
    const channel = event.channel;

    if (!message?.text || !channel?.id) {
      return res.json({ ok: true });
    }

    // ---- Ignore AI messages (loop protection #1) ----
    if (message.user?.id?.startsWith("ai-bot-")) {
      return res.json({ ok: true });
    }

    // ---- Loop protection #2 (dedupe) ----
    if (processedMessages.has(message.id)) {
      return res.json({ ok: true });
    }

    processedMessages.set(message.id, Date.now());
    cleanupProcessedMessages();

    if (processedMessages.size > MAX_CACHE_SIZE) {
      const oldest = processedMessages.keys().next().value;
      if (oldest !== undefined) {
        processedMessages.delete(oldest);
      }
    }

    const channelId = channel.id;

    // ---- Rate limit ----
    if (isRateLimited(channelId)) {
      console.warn(`⏱️ Rate limited channel ${channelId}`);
      return res.json({ ok: true });
    }

    try {
      const aiReply = await generateAIResponse(message.text);
      await sendAIMessage(channelId, aiReply);
    } catch (err) {
      console.error("❌ AI webhook error:", err);

      await sendAIMessage(
        channelId,
        "⚠️ Sorry, something went wrong while generating a response."
      );
    }

    return res.json({ ok: true });
  };
}
