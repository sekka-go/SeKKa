import express, { type Express } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createConfigRouter } from "./routes/config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCaptainRouter } from "./routes/captain.js";
import { createRiderRouter } from "./routes/rider.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPoolRouter } from "./routes/pool.js";

export function createApp(db: DatabaseSync): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "sekka-server",
      phase: 11,
      time: new Date().toISOString(),
    });
  });

  app.use("/api", createConfigRouter(db));
  app.use("/api", createAuthRouter(db));
  app.use("/api", createCaptainRouter(db));
  app.use("/api", createRiderRouter(db));
  app.use("/api", createAdminRouter(db));
  app.use("/api", createPoolRouter(db));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "الصفحة اللي بتدور عليها مش موجودة." });
  });

  return app;
}
