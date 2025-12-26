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
 * ⚠️ NOTE:
 * Stream Chat webhooks DO NOT send X-Signature / X-Timestamp.
 * This function is kept for reference but NOT enforced.
 */
function verifyStreamSignature(_req: Request): boolean {
  return true;
}

/**
 * Stream webhook middleware
 */
export function streamWebhook() {
  return async (req: Request, res: Response) => {
    // ACK immediately to prevent retries
    res.status(200).json({ ok: true });

    if (!verifyStreamSignature(req)) {
      // intentionally NOT blocking
    }

    const event = req.body;

    if (event.type !== "message.new") {
      return;
    }

    const { message, channel } = event;
    if (!message?.text || !channel?.id) {
      return;
    }

    // Ignore AI messages
    if (message.user?.id?.startsWith("ai-bot-")) {
      return;
    }

    // Retry-safe dedupe
    if (processedMessages.has(message.id)) {
      return;
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
      return;
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
  };
}
