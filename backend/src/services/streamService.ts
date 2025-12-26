// backend/src/services/streamService.ts

import { serverClient } from "../serverClient";

export const streamClient = serverClient;


const AI_USER_PREFIX = "ai-bot-";

async function ensureAIUser(userId: string) {
  await streamClient.upsertUser({
    id: userId,
    name: "AI Assistant",
    role: "admin",
  });
}


/**
 * Start typing indicator
 */
export async function startTyping(channelId: string) {
  const userId = `${AI_USER_PREFIX}${channelId}`;
  await ensureAIUser(userId);
  const channel = streamClient.channel("messaging", channelId);
  await channel.sendEvent({
    type: "typing.start",
    user_id: `${AI_USER_PREFIX}${channelId}`,
  });
}

/**
 * Stop typing indicator
 */
export async function stopTyping(channelId: string) {
  const userId = `${AI_USER_PREFIX}${channelId}`;
  await ensureAIUser(userId);
  const channel = streamClient.channel("messaging", channelId);
  await channel.sendEvent({
    type: "typing.stop",
    user_id: `${AI_USER_PREFIX}${channelId}`,
  });
}

/**
 * Send AI message
 */
export async function sendAIMessage(
  channelId: string,
  text: string
) {

  const userId = `${AI_USER_PREFIX}${channelId}`;
  await ensureAIUser(userId);
  const channel = streamClient.channel("messaging", channelId);

  return channel.sendMessage({
    text,
    user_id: `${AI_USER_PREFIX}${channelId}`,
  });
}

/**
 * Send temporary "thinking" message
 */
export async function sendThinkingMessage(
  channelId: string
): Promise<string> {

  const userId = `${AI_USER_PREFIX}${channelId}`;
  await ensureAIUser(userId);
  const channel = streamClient.channel("messaging", channelId);

  const response = await channel.sendMessage({
    text: "🤖 Thinking…",
    user_id: `${AI_USER_PREFIX}${channelId}`,
    silent: true,
  });

  // Stream SDK returns { message: {...}, cid, ... }
  return response.message.id;
}


/**
 * Delete message safely
 */
export async function deleteMessage(messageId: string) {
  await streamClient.deleteMessage(messageId, true);
}
