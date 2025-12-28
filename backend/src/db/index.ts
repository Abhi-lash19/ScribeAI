// backend/src/db/index.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Environment validation
 * Fail fast on boot — not at runtime
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    "[DB INIT ERROR] Missing SUPABASE_URL environment variable"
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "[DB INIT ERROR] Missing SUPABASE_SERVICE_ROLE_KEY environment variable"
  );
}

/**
 * Singleton Supabase client
 * - Server-side only
 * - Uses service role key (bypasses RLS)
 */
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false, // server-only
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Client-Info": "scribeai-backend",
        },
      },
      db: {
        schema: "public",
      },
    }
  );

  return supabaseClient;
}

/**
 * Optional helper:
 * Safe execution wrapper for DB operations
 * - Prevents DB failures from breaking AI flow
 * - Logs errors centrally
 */
export async function safeDbExec<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(
      "[DB ERROR]",
      context ?? "unknown",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}