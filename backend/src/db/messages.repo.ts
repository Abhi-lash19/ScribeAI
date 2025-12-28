// backend/src/db/messages.repo.ts

import { getSupabaseClient, safeDbExec } from "./index";

export type MessageRole = "user" | "ai";

export interface StoredMessage {
  id: string;
  channel_id: string;
  role: MessageRole;
  content: string;
  created_at?: string;
}

const MAX_CONTEXT_MESSAGES = 6;

/**
 * Insert a message into DB (idempotent)
 * - Uses message.id as primary key
 * - Safe on retries
 * - Fire-and-forget friendly
 */
export async function insertMessage(message: StoredMessage): Promise<void> {
  await safeDbExec(
    async () => {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from("messages")
        .upsert(message, {
          onConflict: "id",
        });

      if (error) {
        throw error;
      }
    },
    "insertMessage"
  );
}

/**
 * Fetch last N messages for a channel
 * - Ordered oldest → newest (prompt-friendly)
 * - Hard-limited for token safety
 */
export async function getRecentMessages(
  channelId: string,
  limit: number = MAX_CONTEXT_MESSAGES
): Promise<StoredMessage[]> {
  const result = await safeDbExec(
    async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("messages")
        .select("id, channel_id, role, content, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data ?? []).reverse(); // oldest → newest
    },
    "getRecentMessages"
  );

  return result ?? [];
}
