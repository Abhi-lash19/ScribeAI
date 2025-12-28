// backend/src/db/preferences.repo.ts

import { getSupabaseClient, safeDbExec } from "./index";

export type WritingTone = "formal" | "casual" | "technical";
export type VerbosityLevel = "short" | "medium" | "long";

export interface Preferences {
  channel_id: string;
  tone?: WritingTone;
  verbosity?: VerbosityLevel;
}

/**
 * Get preferences for a channel
 */
export async function getPreferences(
  channelId: string
): Promise<Preferences | null> {
  const result = await safeDbExec(
    async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("preferences")
        .select("channel_id, tone, verbosity")
        .eq("channel_id", channelId)
        .single();

      if (error) throw error;

      return data;
    },
    "getPreferences"
  );

  return result ?? null;
}

/**
 * Upsert preferences for a channel
 */
export async function upsertPreferences(
  prefs: Preferences
): Promise<void> {
  await safeDbExec(
    async () => {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from("preferences")
        .upsert(prefs, { onConflict: "channel_id" });

      if (error) throw error;
    },
    "upsertPreferences"
  );
}
