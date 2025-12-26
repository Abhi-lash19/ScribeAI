// backend/src/services/streamService.ts

import { StreamChat } from "stream-chat";

export const streamClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

export async function sendAIMessage(
  channelId: string,
  text: string
) {
  const channel = streamClient.channel("messaging", channelId);

  await channel.sendMessage({
    text,
    user_id: `ai-bot-${channelId}`,
  });
}
