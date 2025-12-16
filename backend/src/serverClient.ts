// backend/src/serverClient.ts

import { StreamChat } from "stream-chat";
import { config } from "./config";

// Publicly exported API key + secret (server-side only, never to the browser)
export const apiKey = config.stream.apiKey;
export const apiSecret = config.stream.apiSecret;

// Shared server-side StreamChat client.
// NOTE: This must never be used in frontend code.
export const serverClient = new StreamChat(apiKey, apiSecret);

/**
 * Simple connectivity check against Stream.
 * Called once during startup so we fail fast if credentials are wrong.
 */
export async function verifyStreamConnection() {
  const healthUserId = "__healthcheck__";

  try {
    const start = Date.now();
    await serverClient.getAppSettings();

    const duration = Date.now() - start;

    console.log(
      `[StreamChat] health check ok: duration=${duration} ms, apiKey ending=${apiKey.slice(
        -6
      )}`
    );
  } catch (err) {
    console.error("[StreamChat] health check FAILED", err);
    // Rethrow so the process exits during startup instead of returning 502s later.
    throw err;
  }
}
