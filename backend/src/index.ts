// backend/src/index.ts

import cors from "cors";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { streamWebhook } from "./routes/streamWebhook";
import { config } from "./config";
import { verifyStreamConnection } from "./serverClient";
import { serverClient } from "./serverClient";

const app = express();

/* -------------------------------------------------------------------------- */
/*                               Global middleware                             */
/* -------------------------------------------------------------------------- */

app.use(helmet());

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (config.corsOrigin.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
});

app.use(corsMiddleware);
app.options("*", corsMiddleware);

app.use(express.json({ limit: "1mb" }));

app.use(
  morgan(config.env === "production" ? "combined" : "dev")
);

/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */

// Stream webhook
app.post("/webhooks/stream", streamWebhook());

// Token endpoint (Stream auth)
app.post("/token", async (req, res) => {
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiration = issuedAt + 60 * 60; // 1 hour

  const token = serverClient.createToken(
    userId,
    expiration,
    issuedAt
  );

  return res.json({
    token,
    apiKey: config.stream.apiKey,
  });
});

// Health check (Koyeb uses this)
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    env: config.env,
  });
});

/* -------------------------------------------------------------------------- */
/*                              Error handling                                 */
/* -------------------------------------------------------------------------- */

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[ERROR]", err);

    res.status(500).json({
      error: "Internal server error",
    });
  }
);

/* -------------------------------------------------------------------------- */
/*                                   Startup                                   */
/* -------------------------------------------------------------------------- */

async function start() {
  try {
    await verifyStreamConnection();

    app.listen(config.port, () => {
      console.log(
        `🚀 Server running on port ${config.port} (${config.env})`
      );
    });
  } catch (err) {
    console.error("Fatal startup error", err);
    process.exit(1);
  }
}

start();
