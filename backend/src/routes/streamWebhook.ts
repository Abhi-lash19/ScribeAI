// backend/src/routes/streamWebhook.ts

import { Request, Response } from "express";
import crypto from "crypto";
import { isRateLimited } from "../middleware/rateLimiter";
import { generateAIResponse } from "../services/groqService";
import {
  sendAIMessage,
  sendThinkingMessage,
  deleteMessage,
  startTyping,
  stopTyping,
} from "../services/streamService";

/**
 * Retry + loop protection
 * message.id -> processed timestamp
 */
const processedMessages = new Map<string, number>();

const TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 2000;

function cleanupCache() {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > TTL_MS) {
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

  const secret = process.env.STREAM_API_SECRET!;
  const body = JSON.stringify(req.body);
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
  return async (req: Request, res: Response) => {
    if (!verifyStreamSignature(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;

    if (event.type !== "message.new") {
      return res.json({ ok: true });
    }

    const { message, channel } = event;
    if (!message?.text || !channel?.id) {
      return res.json({ ok: true });
    }

    // Ignore AI messages
    if (message.user?.id?.startsWith("ai-bot-")) {
      return res.json({ ok: true });
    }

    // Retry-safe dedupe
    if (processedMessages.has(message.id)) {
      return res.json({ ok: true });
    }

    processedMessages.set(message.id, Date.now());
    cleanupCache();

    if (processedMessages.size > MAX_CACHE_SIZE) {
      const oldest = processedMessages.keys().next().value;
      if (oldest) processedMessages.delete(oldest);
    }

    const channelId = channel.id;

    if (isRateLimited(channelId)) {
      console.warn(`⏱️ Rate limited channel ${channelId}`);
      return res.json({ ok: true });
    }

    let thinkingMessageId: string | null = null;

    try {
      await startTyping(channelId);
      thinkingMessageId = await sendThinkingMessage(channelId);

      const reply = await generateAIResponse(message.text);

      if (thinkingMessageId) {
        await deleteMessage(thinkingMessageId);
      }

      await sendAIMessage(channelId, reply);
    } catch (err) {
      console.error("Webhook AI error:", err);

      if (thinkingMessageId) {
        await deleteMessage(thinkingMessageId);
      }

      await sendAIMessage(
        channelId,
        "⚠️ Sorry, I ran into an issue while responding."
      );
    } finally {
      await stopTyping(channelId);
    }

    return res.json({ ok: true });
  };
}
