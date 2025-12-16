// backend/src/index.ts

import cors from "cors";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { createAgent } from "./agents/createAgent";
import { AgentPlatform, AIAgent } from "./agents/types";
import { config } from "./config";
import { serverClient, verifyStreamConnection } from "./serverClient";

const app = express();

// ----- Global middleware -----
app.use(helmet()); // basic security headers
app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server / curl / Railway health checks
      if (!origin) return callback(null, true);

      if (config.corsOrigin.includes(origin)) {
        return callback(null, true);
      }

      console.warn("❌ CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// THIS LINE FIXES OUR 502
app.options("*", cors());

app.use(express.json({ limit: "1mb" }));
app.use(
  morgan(config.env === "production" ? "combined" : "dev", {
    skip: () => config.env === "test",
  })
);

// ----- In-memory AI agent cache -----
// [user_id: string] => AIAgent
const aiAgentCache = new Map<string, AIAgent>();
const pendingAiAgents = new Set<string>();

// Auto-dispose inactive AI agents (8 hours)
const inactivityThreshold = 480 * 60 * 1000;

setInterval(async () => {
  const now = Date.now();
  for (const [userId, aiAgent] of aiAgentCache) {
    if (now - aiAgent.getLastInteraction() > inactivityThreshold) {
      console.log(`Disposing AI Agent due to inactivity: ${userId}`);
      try {
        await disposeAiAgent(aiAgent);
      } catch (err) {
        console.error(
          `Error while disposing inactive AI agent ${userId}:`,
          err
        );
      }
      aiAgentCache.delete(userId);
    }
  }
}, 5_000);

// ----- Routes -----

// Simple health / status endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "AI Writing Assistant Server is running",
    env: config.env,
    activeAgents: aiAgentCache.size,
  });
});

/**
 * Start the AI Agent for a given channel.
 */
app.post("/start-ai-agent", async (req, res, next) => {
  const { channel_id, channel_type = "messaging" } = req.body as {
    channel_id?: string;
    channel_type?: string;
  };

  console.log(`[API] /start-ai-agent called for channel: ${channel_id}`);

  if (!channel_id) {
    return res.status(400).json({ error: "Missing required field channel_id" });
  }

  const safeChannelId = channel_id.replace(/[!]/g, "");
  const user_id = `ai-bot-${safeChannelId}`;

  try {
    if (!aiAgentCache.has(user_id) && !pendingAiAgents.has(user_id)) {
      console.log(`[API] Creating new agent for ${user_id}`);
      pendingAiAgents.add(user_id);

      // Ensure the AI bot user exists in Stream
      await serverClient.upsertUser({
        id: user_id,
        name: "AI Writing Assistant",
      });

      const channel = serverClient.channel(channel_type, channel_id);
      await channel.addMembers([user_id]);

      const agent = await createAgent(
        user_id,
        AgentPlatform.OPENAI,
        channel_type,
        channel_id
      );

      await agent.init();

      // If another init won the race, dispose this one
      if (aiAgentCache.has(user_id)) {
        console.warn(
          `[API] Agent for ${user_id} already exists, disposing duplicate`
        );
        await agent.dispose();
      } else {
        aiAgentCache.set(user_id, agent);
      }
    } else {
      console.log(`AI Agent ${user_id} already started or is pending.`);
    }

    res.json({ message: "AI Agent started", data: [] });
  } catch (error) {
    console.error("Failed to start AI Agent", error);
    next(error);
  } finally {
    pendingAiAgents.delete(user_id);
  }
});

/**
 * Stop the AI Agent for a given channel.
 */
app.post("/stop-ai-agent", async (req, res, next) => {
  const { channel_id } = req.body as { channel_id?: string };

  console.log(`[API] /stop-ai-agent called for channel: ${channel_id}`);

  if (!channel_id) {
    return res.status(400).json({ error: "Missing required field channel_id" });
  }

  const user_id = `ai-bot-${channel_id.replace(/[!]/g, "")}`;

  try {
    const aiAgent = aiAgentCache.get(user_id);
    if (aiAgent) {
      console.log(`[API] Disposing agent for ${user_id}`);
      await disposeAiAgent(aiAgent);
      aiAgentCache.delete(user_id);
    } else {
      console.log(`[API] Agent for ${user_id} not found in cache.`);
    }
    res.json({ message: "AI Agent stopped", data: [] });
  } catch (error) {
    console.error("Failed to stop AI Agent", error);
    next(error);
  }
});

/**
 * Check agent status for a channel.
 */
app.get("/agent-status", (req, res) => {
  const channel_id = req.query.channel_id;

  if (!channel_id || typeof channel_id !== "string") {
    return res.status(400).json({ error: "Missing channel_id" });
  }

  const user_id = `ai-bot-${channel_id.replace(/[!]/g, "")}`;

  console.log(
    `[API] /agent-status called for channel: ${channel_id} (user: ${user_id})`
  );

  if (aiAgentCache.has(user_id)) {
    console.log(`[API] Status for ${user_id}: connected`);
    return res.json({ status: "connected" });
  }

  if (pendingAiAgents.has(user_id)) {
    console.log(`[API] Status for ${user_id}: connecting`);
    return res.json({ status: "connecting" });
  }

  console.log(`[API] Status for ${user_id}: disconnected`);
  return res.json({ status: "disconnected" });
});

// Explicit preflight handler for /token
app.options("/token", (_req, res) => {
  res.sendStatus(200);
});

/**
 * Token provider endpoint - generates user tokens.
 */
app.post("/token", async (req, res, next) => {
  try {
    const { userId } = req.body as { userId?: string };

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiration = issuedAt + 60 * 60; // 1 hour

    const token = serverClient.createToken(userId, expiration, issuedAt);

    res.json({ token, apiKey: config.stream.apiKey });
  } catch (error) {
    console.error("Error generating token:", error);
    next(error);
  }
});

// ----- Helpers -----

async function disposeAiAgent(aiAgent: AIAgent) {
  await aiAgent.dispose();
  if (!aiAgent.user) return;

  await serverClient.deleteUser(aiAgent.user.id, {
    hard_delete: true,
  });
}

// ----- 404 + error handlers -----

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[ERROR] Unhandled error:", err);

    // Avoid leaking internals in production
    if (config.env === "production") {
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(500).json({
      error: "Internal server error",
      details: err instanceof Error ? err.message : String(err),
    });
  }
);

// ----- Startup -----

async function start() {
  try {
    await verifyStreamConnection();

    app.listen(config.port, () => {
      console.log(
        `Server is running on port ${config.port} (env=${config.env})`
      );
    });
  } catch (err) {
    console.error("Fatal error during startup, exiting.", err);
    process.exit(1);
  }
}

start();
