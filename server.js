// server.js — Custom Next.js server for shared cPanel/Hepsia hosting
// NodeJS Script Path: /www/boyanihealth.africandivinechurch.org/server.js
// NodeJS Version: v26.3.0
// Port: 25551
//
// 1. Forces the working directory to this file's folder (Hepsia may launch
//    the app from elsewhere).
// 2. Forces DATABASE_URL to an ABSOLUTE path under the app root — the
//    permanent fix for the relative-SQLite-path failure that made every
//    public slug page return "This page couldn't load" (Instruction 3).
// 3. Falls back to port 25551 when cPanel does not inject PORT.
process.chdir(__dirname);

const path = require("path");
const fs = require("fs");

// ── Absolute SQLite path — honours legacy / new locations ──
// Priority: <app>/db/custom.db (legacy live data, if the operator had one)
//        → <app>/prisma/db/custom.db (canonical — shipped, seeded, and where
//           `npx prisma db push` / `npx tsx prisma/seed.ts` naturally write).
(function enforceDatabaseUrl() {
  const raw = process.env.DATABASE_URL || "file:./db/custom.db";
  if (!raw.startsWith("file:")) return; // postgres/mysql — leave untouched
  let p = raw.slice("file:".length);
  if (p.startsWith("//")) p = p.slice(1);
  if (!path.isAbsolute(p)) {
    const candidates = [
      path.join(__dirname, "db", "custom.db"),
      path.join(__dirname, "prisma", "db", "custom.db"),
      path.join(__dirname, p), // any other custom relative location
    ];
    const existing = candidates.find(c => { try { return fs.statSync(c).isFile(); } catch (e) { return false; } });
    const absolute = existing || candidates[1]; // default = canonical prisma/db
    try { fs.mkdirSync(path.dirname(absolute), { recursive: true }); } catch (e) { /* best effort */ }
    process.env.DATABASE_URL = `file:${absolute}`;
  }
})();

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

// On a live/shared host the app always runs in production mode.
// Turbopack (Next.js 15+ dev default) requires native glibc ≥ 2.29 bindings
// that are unavailable on older VPS kernels — forcing production avoids it
// entirely and also gives you the optimised build rather than the slow dev one.
if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";
const dev = process.env.NODE_ENV !== "production";

// Hepsia injects PORT automatically; fall back to 25551 (assigned port)
const port = parseInt(process.env.PORT || "25551", 10);
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Boyani Health Dispensary ready on port ${port}`);
    console.log(`> Running from: ${__dirname}`);
    console.log(`> Database: ${process.env.DATABASE_URL}`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
  });
});
