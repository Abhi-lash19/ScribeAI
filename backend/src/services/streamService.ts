// backend/src/services/streamService.ts

import { StreamChat } from "stream-chat";

export const streamClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

const AI_USER_PREFIX = "ai-bot-";

/**
 * Start typing indicator
 */
export async function startTyping(channelId: string) {
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
