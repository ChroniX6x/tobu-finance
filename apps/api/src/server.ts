// src/server.ts
import "dotenv/config";
import { contractResponses } from "./middleware/contracts.js";
import { schemaStatus } from "./database/baseline.js";
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { connectDB } from "./db.js";
import errorHandler from "./middleware/error.js";

// --- Auth-Module (gekapselt) ---
import { router as authRouter } from "./auth/index.js";
import { requireAuth /*, requireRole*/ } from "./auth/middleware.js";
import { authEnv } from "./auth/config.js";

// --- Deine bestehenden Routen ---
import members from "./routes/members.js";
import accounts from "./routes/accounts.js";
import categories from "./routes/categories.js";
import transactions from "./routes/transactions.js";
import recurrences from "./routes/recurrences.js";
import memberIncomes from "./routes/member-incomes.js";
import rules from "./routes/contribution-rules.js";
import carryovers from "./routes/carryovers.js";
import balances from "./routes/account-balances.js";
import budgets from "./routes/category-budgets.js";
import docsRouter from "./docs/swagger.js";
import accountsSummaryRouter from "./routes/accounts-summary.js";
import accountOverviewRouter from "./routes/account-overview.js";
import monthViewRouter from "./routes/month-view.js";
import masterDataRouter from "./routes/master-data.js";
import planningRouter from "./routes/planning.js";


async function bootstrap() {
  const app = express();

  // Security & Parsing
  app.use(helmet({ contentSecurityPolicy: false })); // CSP bei Bedarf später feinjustieren
  app.use(express.json());
  app.use(cookieParser());
  if (process.env.NODE_ENV === "test" || process.env.TOBU_VALIDATE_RESPONSES === "1") app.use(contractResponses);
  app.use(morgan("dev"));

  // CORS – zentral über Auth-ENV (Frontend-URL)
  app.use(
    cors({
      origin: authEnv.CORS_ORIGIN,
      credentials: true, // wichtig für Refresh-Cookie bei /api/auth/refresh
    })
  );

  // Öffentliche Endpunkte (außerhalb /api) zuerst:
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ready", async (_req, res) => {
    try { const status = await schemaStatus(); res.status(status.ready ? 200 : 503).json(status); }
    catch { res.status(503).json({ ready: false, status: "database-unavailable" }); }
  });
  app.use(docsRouter); // /docs & /openapi.json bleiben öffentlich

  // /api/auth bleibt öffentlich (Login/Refresh/Logout)
  app.use("/api/auth", authRouter);

  // Zentrales Gate: ALLES unter /api schützen – außer /api/auth/*
  app.use("/api", (req, res, next) => {
    // CORS-Preflight ohne Auth durchlassen
    if (req.method === "OPTIONS") return next();
    // /api/auth explizit ausnehmen
    if (req.path.startsWith("/auth")) return next();
    // sonst Auth prüfen
    return requireAuth(req, res, next);
  });

  // --- Ab hier sind alle /api/* Routen geschützt ---

  app.use("/api/members", members);

  // Wichtig: Spezifische account-Routen VOR dem generischen Router!
  app.use("/api/accounts", accountsSummaryRouter);
  app.use("/api/accounts", accountOverviewRouter);
  app.use("/api/accounts", monthViewRouter);
  app.use("/api/accounts", masterDataRouter);
  app.use("/api/accounts", planningRouter);
  app.use("/api/accounts", accounts);

  app.use("/api/categories", categories);
  app.use("/api/transactions", transactions);
  app.use("/api/recurrences", recurrences);
  app.use("/api/member-incomes", memberIncomes);
  app.use("/api/contribution-rules", rules);
  app.use("/api/carryovers", carryovers);
  app.use("/api/account-balances", balances);
  app.use("/api/category-budgets", budgets);

  // Compatibility endpoint for the active baseline; archived Umzug scripts never run.
  app.get("/health/migrations", async (_req, res) => {
    const status = await schemaStatus();
    res.status(status.ready ? 200 : 503).json(status);
  });

  // Error-Handler (immer zuletzt)
  app.use(errorHandler);

  // DB + Start
  const port = Number(process.env.PORT || 4000);
  await connectDB(process.env.MONGODB_URI || "");
  const server = app.listen(port, process.env.HOST || "127.0.0.1", () => console.log(`API on :${port}`));
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close(() => { void mongoose.disconnect().then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

// Starten
bootstrap().catch((err) => {
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
