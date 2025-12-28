// backend/src/db/channels.repo.ts

import { getSupabaseClient, safeDbExec } from "./index";

export interface ChannelRecord {
  channel_id: string;
  title?: string;
}

/**
 * Create channel row if not exists.
 * Optionally sets title ONLY if not already present.
 */
export async function upsertChannel(
  channelId: string,
  title?: string
): Promise<void> {
  await safeDbExec(
    async () => {
      const supabase = getSupabaseClient();

      // First ensure channel exists
      await supabase
        .from("channels")
        .upsert(
          { channel_id: channelId },
          { onConflict: "channel_id" }
        );

      // If title provided, update ONLY if title is null
      if (title) {
        await supabase
          .from("channels")
          .update({ title })
          .eq("channel_id", channelId)
          .is("title", null);
      }
    },
    "upsertChannel"
  );
}

/**
 * Fetch channel title (used later by frontend)
 */
export async function getChannelTitle(
  channelId: string
): Promise<string | null> {
  const result = await safeDbExec(
    async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("channels")
        .select("title")
        .eq("channel_id", channelId)
        .single();

      if (error) throw error;

      return data?.title ?? null;
    },
    "getChannelTitle"
  );

  return result ?? null;
}
