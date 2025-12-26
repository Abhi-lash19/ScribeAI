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
  try {
    const start = Date.now();

    // This call does NOT touch users at all
    await serverClient.getAppSettings();

    console.log(
      `[StreamChat] health check OK (${Date.now() - start} ms)`
    );
  } catch (err) {
    console.error("[StreamChat] health check FAILED", err);

    // ❗ DO NOT crash app in dev
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
  }
}

