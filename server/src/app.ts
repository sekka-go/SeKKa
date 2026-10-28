import express, { type Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { createConfigRouter } from "./routes/config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCaptainRouter } from "./routes/captain.js";
import { createRiderRouter } from "./routes/rider.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPoolRouter } from "./routes/pool.js";

export function createApp(db: DatabaseSync): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://tile.openstreetmap.org https://uorxfakceqnhxqnaawdy.supabase.co; connect-src 'self' https://uorxfakceqnhxqnaawdy.supabase.co wss://uorxfakceqnhxqnaawdy.supabase.co https://photon.komoot.io https://nominatim.openstreetmap.org https://router.project-osrm.org; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
    });
    next();
  });
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "sekka-server",
      phase: 14,
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

  const webDist = process.env.SEKKA_WEB_DIST ?? path.resolve(process.cwd(), "../web/dist");
  const webIndex = path.join(webDist, "index.html");
  if (existsSync(webIndex)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || path.extname(req.path)) { next(); return; }
      res.sendFile(webIndex, (error) => { if (error) next(error); });
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const parserError = error as { type?: string; status?: number };
    if (parserError?.type === "entity.too.large") {
      res.status(413).json({ error: "حجم الطلب أكبر من المسموح." });
      return;
    }
    if (parserError?.type === "entity.parse.failed") {
      res.status(400).json({ error: "صيغة الطلب غير صحيحة." });
      return;
    }
    res.status(parserError?.status && parserError.status < 500 ? parserError.status : 500)
      .json({ error: "حصل خطأ غير متوقع. حاول مرة أخرى." });
  });

  return app;
}
