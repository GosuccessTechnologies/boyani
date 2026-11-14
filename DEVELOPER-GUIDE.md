# BOYANI HEALTH DISPENSARY — DEVELOPER GUIDE & CORRECTION PLAN
**Generated:** 2026-11-09 · **Source:** boyani.zip audit · **Status:** ALL CORRECTIONS IMPLEMENTED & VERIFIED (see worklog.md Task boyani-instr-1-7)

This file records the full codebase audit findings and the correctional plan for
Instructions 1–7. It is the single source of truth consumed during the correction
phase. Every fix below is marked ☐ (pending) / ☑ (done) as work proceeds.

---

## PART A — SYSTEM ARCHITECTURE (as audited)

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.3.5 (App Router, Turbopack dev / `--webpack` build) | `reactStrictMode:false`, `typescript.ignoreBuildErrors:true` |
| DB | Prisma 6.19 + SQLite | `DATABASE_URL="file:./db/custom.db"` |
| Auth | Bearer-token sessions (Session table) + `requireAuth` | NOT NextAuth (next-auth installed but unused) |
| Styling | Tailwind 4 + shadcn/ui + `--mc-*` CSS variable theme system | 10 seeded themes in `Theme` table |
| Public site | `(public)` route group, 18 homepage designs, 40 widgets, 10 headers, 10 footers, 14 sliders, 6 breadcrumbs | All data-driven from Prisma |
| Dashboards | `admin`, `website-manager`, `doctor`, `registrar`, `frontdesk`, `cashier`, `nursing`, `lab`, `inventory`, `hr`, `pharmacy`, `attendance` portals via `PortalShell` | Launcher at `/launcher` |
| Theme runtime | `ThemeProvider` (client) fetches `/api/themes`, injects `--mc-*` vars on `<html>` | Wrap in root `layout.tsx` — affects everything |

### Database files (IMPORTANT)
- `prisma/db/custom.db` — the file Prisma actually resolves at runtime
  (`file:./db/custom.db` is schema-relative → `prisma/db/custom.db`). Contains the
  Mudhiero seed; `SiteSetting`: theme 5, homepage 3, header 2, footer 1.
- `db/custom.db` — STALE copy containing "KEDAN PHARMCARE" data (previous test).
  Dangerous confusion source. Plan: make `<app-root>/db/custom.db` the single
  canonical DB (matches `.env` comment + cPanel docs), re-seeded with Boyani data.

---

## PART B — FINDINGS & CORRECTIONAL PLAN PER INSTRUCTION

### INSTRUCTION 1 — Full-system audit (tables, forms, modals, pages, dashboards, menus, row buttons, layout)

**Findings:**
- Architecture is sound: DataTable (`src/components/shared/DataTable.tsx`) drives
  all admin tables with view/edit/delete/print action buttons; PremiumModal is the
  standard modal; forms use controlled inputs (`McInput`/`Field`/`FormSection`).
- Production build previously passed (per worklog) — 139 routes.
- ⚠ CRITICAL: under the Next.js 16 server runtime the Prisma SQLite **relative**
  path fails to open ("Error code 14: Unable to open the database file"). Every
  public data helper silently `.catch()`es → homepage renders fallback defaults
  (looks OK) while slug pages 404/500 → the exact "flash then error" symptom.
  (Full analysis under Instruction 3.)
- ⚠ No `error.tsx` / `not-found.tsx` boundaries in the app — raw Next.js fallbacks.
- Minor: `HeaderDesign7` hardcodes logo initial "M"; `BreadcrumbDesign6`
  hardcodes `tel:+254700999999`.

**Corrections:**
1. ☑ Fix DB resolution (Instruction 3 root fix) — makes every table/form/modal/dashboard work.
2. ☑ Add `(public)` `not-found.tsx` + root `error.tsx` boundaries (graceful fallbacks).
3. ☑ Remove hardcoded phone/initial in BreadcrumbDesign6/HeaderDesign7 (brand pass).
4. ☑ Verify all public pages + dashboards return 200 after fixes (smoke matrix).

### INSTRUCTION 2 — Rebrand to Boyani Health Dispensary

**New entity details:**
- Name: **Boyani Health Dispensary**
- Location: **Vihiga** (Vihiga County, Kenya)
- Phone: **0750239057**
- Email: **info@africandivinechurch.org**
- Domain: **https://www.boyanihealth.africandivinechurch.org**

**Findings — hardcoded brand references (60 hits across 36 files):**
- `prisma/seed.ts` — company_config, branches, users (13 emails @mudhieronursinghome.or.ke),
  employees (email pattern), web pages content, news posts, downloads, gallery captions,
  testimonials, sliders, menus, job descriptions, SMTP/SMS config, watermark, SEO titles.
- `src/lib/public-data.ts` — fallback defaults (`company_name: 'Mudhiero Nursing Home'`,
  `company_phone: '00000000000'`, Butere address, etc.).
- `src/app/layout.tsx` — root metadata (title template, description, keywords, OG).
- `src/hooks/use-company.ts` + `src/app/api/company/route.ts` — client-side defaults.
- `src/lib/document-print.ts` — print header defaults.
- Fallback strings `|| 'Mudhiero Nursing Home'` in launcher, PortalShell, DataTable,
  attendance header, pos/_lib, hr/payroll, admin/documents, admin/quotations,
  communication API, printer-settings API, headers/footers widgets, LoginDesigns copy.
- `public/manifest.json` — PWA name "Mudhiero Nursing Home Attendance".
- Footer `BrandBlock` — hardcoded "Butere families — Mudhiero Nursing Home" sentence.
- Careers/FAQ/news/contact page metadata descriptions.
- `pos_receipt_prefix: 'MNH'` in seed.

**Corrections:**
1. ☑ Rewrite `prisma/seed.ts` with Boyani Health Dispensary details (name, Vihiga,
   0750239057, info@africandivinechurch.org, new email domain, BHD receipt prefix,
   Vihiga coordinates 0.0659/34.7180, SEO titles, branch names).
2. ☑ Replace ALL hardcoded fallbacks in src/ with Boyani values (fallbacks remain as
   safety nets when DB is empty, but must carry the correct brand).
3. ☑ Update `public/manifest.json` (name/short_name → Boyani).
4. ☑ Keep everything dynamic-first: fallbacks only used when DB returns nothing.
5. ☑ Re-seed the canonical DB with new data; verify no "Mudhiero"/"Butere" strings
   remain in src/ or seed output (domain references in old URLs updated too).

### INSTRUCTION 3 — Slug pages fail to load ("page couldn't load… flash then disappear")

**Root cause (verified by reproduction in this sandbox):**
1. `DATABASE_URL="file:./db/custom.db"` is a RELATIVE SQLite URL. Prisma resolves
   it relative to the schema directory at generate time, but under the **Next.js 16
   server runtime** (Turbopack dev AND the production server launched from a
   different cwd — exactly the cPanel/Hepsia case `server.js` guards against with
   `process.chdir`) the engine receives a path that does not exist →
   `Error code 14: Unable to open the database file` on EVERY query.
2. Public helpers wrap queries in `.catch(() => …)`:
   - Homepage: falls back to defaults → renders fine (masking the disease).
   - `news/[slug]`: `.catch(() => null)` → `notFound()` → 404.
   - `services/[slug]`, `services` list: NO catch → query throws → 500 error
     boundary → **"This page couldn't load. Reload to try again, or go back."**
   - On reload, SSR HTML streams (the "flash"), then the client error/not-found
     boundary replaces the tree → page "disappears immediately".

**Permanent corrections:**
1. ☑ New `src/lib/db.ts`: resolve the SQLite file to an ABSOLUTE path at runtime
   (candidates: env value if absolute → `process.cwd()/db/custom.db` →
   `process.cwd()/prisma/db/custom.db` → module-relative fallbacks), pass
   `datasourceUrl` to PrismaClient. Works under any bundler/cwd.
2. ☑ Same resolution helper used by `prisma/seed.ts` so CLI seeding and app runtime
   always agree on ONE file.
3. ☑ Canonical DB location: `<app-root>/db/custom.db` (delete stale KEDAN copy;
   re-seed fresh Boyani data; keep `prisma/db/custom.db` absent).
4. ☑ `server.js` also forces `process.env.DATABASE_URL` to the absolute path under
   the app root before Next boots (belt & braces for cPanel).
5. ☑ Add `.catch()` guards to slug/list page queries (services list + slug) so a
   transient DB hiccup renders the graceful "being updated" empty state instead of
   a hard error.
6. ☑ Add public `not-found.tsx` and root `error.tsx` with brand-styled fallbacks.
7. ☑ Verify every public route 200s with real DB content (services slug ×12,
   news slug ×6, about ×4, careers, doctors, gallery, faq, downloads, booking, contact).

### INSTRUCTION 4 — Sliders must play appropriately in homepage designs

**Findings (audited all 14 designs in `SliderDesigns.tsx`):**
- Auto-advance via `useSliderLogic` interval; pause on hover; arrows + dots.
- Issues found:
  1. `SliderRouter` ignores per-slide `autoRotate` and `rotateDelayMs` from the DB
     (always 6.5s default, rotates even when slider row says otherwise).
  2. Manual dot/arrow clicks do NOT reset the timer → current slide is cut short
     immediately after a manual navigation (feels "jumpy"/broken).
  3. `SliderDesign8` typewriter: `setTyped` interval can fire after unmount path
     is guarded, but the interval also continues when `paused` (hover) — minor.
     Guard `slide` undefined before `slides.length` check (render uses `slide.id`
     in design 13/5 — `slides[index]` can be undefined mid- resize/state race when
     slides array identity changes → `slide.id` crash → exactly the class of
     client error that kills the page).
  4. `SliderDesign4/5/11/13/14` use `slides[index]` directly (`const slide =
     slides[index]`) then `slide.id` — no guard → potential crash when slides
     shrink (admin deactivates a slide while tab open).
  5. `SliderDesign12` renders `<Link>` (anchor) INSIDE `<button>` — invalid HTML
     nesting; React 19 hydration can hard-error → page replaced by error boundary.
  6. Duplicate `@keyframes mc-fade-up` definitions across designs are fine, but
     design 2/4 declare `transition-duration-800` (non-existent Tailwind class)
     — cosmetic dead classes.
  7. Dots in TYPE C/D panels are white-on-gradient (fine), but TYPE B bar dots use
     `--mc-secondary` — OK. No functional issue.
  8. `HeroSliderWidget` clamps variant 1–14 — good; widget variantId is source of
     truth (documented) — keep.

**Corrections:**
1. ☑ Harden `useSliderLogic`: clamp index when slides length changes; reset timer
   on manual navigation; respect per-slide `autoRotate=false` (pause auto-advance)
   and `rotateDelayMs` (use median/first slide delay as the interval).
2. ☑ Guard `const slide = slides[index]` in designs 4/5/8/13/14 with
   `if (!slide) return null` after the length check.
3. ☑ Fix design 12 nesting: replace outer `<button>` with `<div role="button">`
   (keep onClick) so the CTA Link inside is valid HTML.
4. ☑ Remove dead Tailwind classes (`duration-800`, `duration-600`) → inline style
   transition durations already present.
5. ☑ Pause typewriter effect while `paused` in design 8.
6. ☑ Verify each homepage design (1–18) renders its slider without console errors.

### INSTRUCTION 5 — Theme management must drive the whole system

**Findings:**
- **CRITICAL BUG:** `ThemeProvider.refresh()` fetches `/api/themes` but the
  non-`public=1` GET response is `{ themes, activeThemeId, siteSetting }` — it
  NEVER contains `activeTheme`. Code then does
  `data.activeTheme || data.themes[0]` → **always applies Theme 1** regardless of
  the admin's choice. So changing the theme at `/admin/themes` appears to do
  nothing on the public site and dashboards. (The DB currently has theme 5 active
  but every visitor gets theme 1.)
- The `/api/themes?public=1` variant returns `{ activeTheme }` but nothing calls it.
- Public header/footer/homepage/buttons/borders already consume `--mc-*` vars, and
  `PortalShell` (all dashboards) + launcher already consume `useTheme()` +
  `--mc-*` vars → once the provider applies the REAL active theme, everything
  follows: header bg (`--mc-bg-header`), footer bg (`--mc-bg-footer`), buttons
  (`--mc-primary`), borders (`--mc-divider`), sidebar (`--mc-bg-sidebar` +
  `sidebarStyle`), card headers, body font/format, custom CSS.
- `applyThemeVars` also maps shadcn tokens via `:root` CSS (`--primary`,
  `--border`, `--sidebar`, …) → shadcn components follow automatically.
- Admin Themes page (487 lines) supports create/edit/duplicate/reset/apply —
  apply updates `SiteSetting.activeThemeId` correctly; only the provider read is
  broken.
- Secondary gap: SSR renders with Theme-1 defaults; client applies real theme on
  mount (brief flash on first paint). Acceptable, but we add a
  `<style>` SSR inline pre-paint injection via the public layout to eliminate the
  flash: server-render the active theme's vars into a `<style id="mc-ssr-theme">`
  tag. (Root layout can't query DB per-request cheaply? It can — the public
  layout is already force-dynamic; but admin layouts are static-ish. Compromise:
  inject SSR vars in the `(public)/layout.tsx` and keep client provider for all
  dashboards. Also honor `headingFormat` (uppercase/bold) — currently unused!)

**Corrections:**
1. ☑ Fix `ThemeProvider`: resolve the active theme from the full list response via
   `activeThemeId` (fall back to `?public=1` shape) and apply THAT; keep themes
   list for consumers.
2. ☑ Apply `headingFormat` (normal | uppercase | bold) → set
   `--mc-heading-transform`/`--mc-heading-weight` vars + CSS rules.
3. ☑ SSR theme pre-paint: public layout injects active theme vars server-side so
   the first paint already has the right colors (no teal flash for theme 5 users).
4. ☑ Verify PortalShell sidebar/header/footer react to theme changes (light/dark
   sidebar styles) and launcher gradient follows `--mc-primary`.
5. ☑ E2E: apply each of the 10 themes → check header/footer/button/border/sidebar
   colors change on public site + a dashboard.

### INSTRUCTION 6 — Deployment files (own .env + server.js)

**Required production values:**
- NodeJS Script Path: `/www/boyanihealth.africandivinechurch.org/server.js`
- Port: **25551**
- NODE_ENV: production
- Website URL: **https://www.boyanihealth.africandivinechurch.org**

**Findings:**
- Current `server.js` hardcodes port 26548 + Mudhiero banner; `.htaccess` proxies
  to `localhost:26548`; `.env` has old domain, `NEXT_PUBLIC_APP_URL` /
  `APP_URL` pointing at localhost; `package.json` name `mudhiero-nursing-home`;
  `sitemap.ts`/`robots.ts` read `NEXT_PUBLIC_SITE_URL` (NOT set in .env!).

**Corrections:**
1. ☑ Rewrite `server.js`: chdir to `__dirname`, force absolute `DATABASE_URL`,
   port `parseInt(process.env.PORT || '25551')`, boot message "Boyani Health
   Dispensary".
2. ☑ Rewrite `.env`: boyani domain URLs (`NEXT_PUBLIC_APP_URL`, `APP_URL`,
   `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` — new var consumed by sitemap/robots),
   port 25551 documented, fresh secrets, Boyani SMTP placeholders.
3. ☑ `.htaccess`: proxy to `http://localhost:25551`.
4. ☑ `package.json`: name `boyani-health-dispensary`, start script uses server.js
   (PORT env respected), remove tee dev.log hack from dev script? (keep, dev-only).
5. ☑ `Caddyfile`: update domain + port for parity.
6. ☑ Keep `next.config.ts` webpack-forced (glibc-safe for cPanel) as-is.

### INSTRUCTION 7 — Durability workflow

**Requirements:** everything written to disk; git commit after every logical unit;
verify changes actually landed; maintain worklog; final zip + upload to qu.ax.

**Corrections (process):**
1. ☑ Git repo initialized at project root; commit after each instruction's changes.
2. ☑ Append every step to `worklog.md` as tasks complete.
3. ☑ Final: `npm run build` production check → zip project (excluding
   node_modules/.next/.git) → save to download/ → upload to https://qu.ax →
   report link.

---

## PART C — VERIFICATION MATRIX (must all pass before delivery)

| Check | Method |
|---|---|
| DB opens under Next runtime | dev server boot, zero "Error code 14" |
| All public pages 200 | curl matrix (home, services, 12 service slugs, news, 6 news slugs, about ×4, doctors, gallery, faq, downloads, careers, booking, contact) |
| Admin/dashboards 200 | login + curl (admin, website-manager, launcher, …) |
| Theme switching | apply theme via API → check CSS vars on public page |
| Sliders | all 18 homepage designs render + rotate (design preview `?design=N`) |
| Rebrand | grep -ri "mudhiero\|butere" src/ → 0 hits (excluding historical worklog/DEVELOPER-GUIDE) |
| Production build | `npm run build` exit 0 |
| Package | zip in download/ + qu.ax upload |

---

## PART D — IMPLEMENTATION ORDER

1. Instr 3 (DB resolution + page guards + boundaries) — unlocks everything.
2. Instr 2 (seed rewrite + hardcoded sweep + manifest).
3. Instr 4 (slider hardening).
4. Instr 5 (ThemeProvider fix + SSR vars + headingFormat).
5. Instr 6 (.env, server.js, .htaccess, package.json, Caddyfile).
6. Re-seed DB, full verification matrix, build, worklog, zip, upload (Instr 1+7).
