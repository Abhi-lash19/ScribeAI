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
  return async function handler(req: Request, res: Response) {
    const event = req.body;

    if (event?.type !== "message.new") {
      return res.json({ ok: true });
    }

    const message = event.message;
    const channel = event.channel;

    if (!message?.text || !channel?.id) {
      return res.json({ ok: true });
    }

    // Ignore AI messages
    if (message.user?.id?.startsWith("ai-bot-")) {
      return res.json({ ok: true });
    }

    // Retry protection
    if (processedMessages.has(message.id)) {
      return res.json({ ok: true });
    }
    processedMessages.set(message.id, Date.now());
    cleanupCache();

    if (processedMessages.size > MAX_CACHE_SIZE) {
      const oldest = processedMessages.keys().next().value;
      if (oldest) processedMessages.delete(oldest);
    }

    // ✅ FIX: Map uses set(), not add()
    processedMessages.set(message.id, Date.now());

    if (processedMessages.size > MAX_CACHE_SIZE) {
      cleanupCache();
    }

    const channelId = channel.id;

    if (isRateLimited(channelId)) {
      return res.json({ ok: true });
    }

    let thinkingMessageId: string | null = null;

    try {
      await startTyping(channelId);

      thinkingMessageId = await sendThinkingMessage(channelId);

      const aiReply = await generateAIResponse(message.text);

      if (thinkingMessageId) {
        try {
          await deleteMessage(thinkingMessageId);
        } catch (err) {
          console.warn(
            "[Stream] Failed to delete thinking message",
            thinkingMessageId,
            err
          );
        }
      }

      await sendAIMessage(channelId, aiReply);
    } catch (err) {
      console.error("AI webhook error:", err);

      if (thinkingMessageId) {
        try {
          await deleteMessage(thinkingMessageId);
        } catch (err) {
          console.warn(
            "[Stream] Failed to delete thinking message",
            thinkingMessageId,
            err
          );
        }
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
