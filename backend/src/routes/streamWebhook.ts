// backend/src/routes/streamWebhook.ts

import { Request, Response } from "express";
import { isRateLimited } from "../middleware/rateLimiter";
import { generateAIResponse } from "../services/groqService";
import { insertMessage } from "../db/messages.repo";
import { upsertChannel } from "../db/channels.repo";

import {
  sendAIMessage,
  startTyping,
  stopTyping,
  renameChannel,
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

function generateSessionTitle(text: string): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").slice(0, 6).join(" ");

  return words.charAt(0).toUpperCase() + words.slice(1);
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

    // Retry / duplicate protection
    if (processedMessages.has(message.id)) {
      return res.json({ ok: true });
    }

    processedMessages.set(message.id, Date.now());
    cleanupCache();

    if (processedMessages.size > MAX_CACHE_SIZE) {
      const oldestKey = processedMessages.keys().next().value;
      if (oldestKey) processedMessages.delete(oldestKey);
    }

    const channelId = channel.id;
    const title = generateSessionTitle(message.text);

    // 🔹 Rename Stream channel ONLY if name not set
    if (!channel.name) {
      await renameChannel(channelId, title);
      await upsertChannel(channelId, title);
    }
    // Persist user message (non-blocking)
    insertMessage({
      id: message.id,
      channel_id: channelId,
      role: "user",
      content: message.text,
    });

    if (isRateLimited(channelId)) {
      return res.json({ ok: true });
    }

    try {
      await startTyping(channelId);

      const aiReply = await generateAIResponse({
        userInput: message.text,
        channelId,
      });

      await sendAIMessage(channelId, aiReply);

      // Persist AI message (non-blocking)
      insertMessage({
        id: `ai-${message.id}`,
        channel_id: channelId,
        role: "ai",
        content: aiReply,
      });

    } catch (err) {
      console.error("AI webhook error:", err);

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
