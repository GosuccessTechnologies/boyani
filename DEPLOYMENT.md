# Boyani Health Dispensary — Complete Production Deployment Manual

**Institution :** Boyani Health Dispensary  
**Repository  :** https://github.com/GosuccessTechnologies/boyani.git  
**Domain      :** www.boyanihealth.africandivinechurch.org  
**Stack       :** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Prisma 6 · Turso (SQLite)

---

## Overview — The Full Pipeline

```
[GitHub]             [Turso Cloud]        [Vercel]               [DNS]
Push code        →   Import database  →   Deploy project    →   Point domain
```

Do everything in this exact order:

1. **GitHub** — push all project files to the GitHub repository
2. **Turso** — run the automated upload script to import `prisma/db/custom.db`
3. **Vercel** — import project from GitHub, connect Turso, set env vars, deploy
4. **Domain DNS** — add DNS records at your domain registrar
5. **Verify** — confirm everything is live

> **Build lifecycle on Vercel:**
> `package.json` has `"postinstall": "prisma generate"`. Vercel runs
> `npm install` → `prisma generate` automatically, then `npm run build`.

---

## Turso Database Credentials

| Field | Value |
|---|---|
| Database Name | `database-almond-flask` |
| Turso Cloud ID | `01a1d8e4-e401-7263-9444-9b88fdbb4b82` |
| Database URL | `libsql://database-almond-flask-vercel-icfg-nqyfsjgpv0n6qswkwibuyrtf.aws-us-east-1.turso.io` |
| Auth Token | *(auto-updated by turso-upload.js — see .env)* |
| Organization Slug | `vercel-icfg-nqyfsjgpv0n6qswkwibuyrtf` |
| Turso Dashboard | https://app.turso.tech/vercel-icfg-nqyfsjgpv0n6qswkwibuyrtf |
| Vercel Integration | https://vercel.com/jayieko250-3278s-projects/boyani/integrations/tursocloud/icfg_NQYfsjGPv0N6QswkWiBuYRTf/resources/storage/store_codUyA1ZRniipD6M/guides |

---

## PHASE 1 — Upload Database to Turso

### 1.1 Open Git Bash and navigate to the project folder

```bash
cd "C:/Users/user/Downloads/AfricaDevine/work/Boyani"
```

### 1.2 Run the automated Turso upload script

```bash
node scripts/turso-upload.js
```

A `✅ SUCCESS` message means the database is uploaded and ready.

### 1.3 Verify the import (optional)

1. Go to https://app.turso.tech/vercel-icfg-nqyfsjgpv0n6qswkwibuyrtf
2. Click **Databases** → open **database-almond-flask**
3. Click the **Shell** tab and run:

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

---

## PHASE 2 — Push to GitHub

### 2.1 Open Git Bash in the project folder

```bash
cd "C:/Users/user/Downloads/AfricaDevine/work/Boyani"
```

### 2.2 Initialise Git and connect to the repository

```bash
git init
git remote add origin https://github.com/GosuccessTechnologies/boyani.git
```

### 2.3 Configure Git identity (skip if already set globally)

```bash
git config user.name "GosuccessTechnologies"
git config user.email "jayieko250@gmail.com"
```

### 2.4 Stage, commit and push

```bash
git add .
git commit -m "feat: Boyani — configure Turso for Vercel deployment"
git branch -M main
git push -u origin main
```

---

## PHASE 3 — Vercel Setup and Deployment

### 3.1 Import the project from GitHub

1. Go to https://vercel.com → sign in
2. Dashboard → **Add New → Project**
3. **Import Git Repository** → find `GosuccessTechnologies/boyani` → **Import**
4. Framework: **Next.js** (auto-detected)
5. Root Directory: leave blank

**Do NOT click Deploy yet.**

### 3.2 Connect the Turso integration

1. In the Vercel project → **Storage** tab
2. **database-almond-flask** should appear linked. If not, click **Connect to Project**
3. Vercel automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`

### 3.3 Set the remaining Environment Variables

Go to **Project → Settings → Environment Variables** → select **All Environments**:

| Name | Value |
|---|---|
| `NEXTAUTH_SECRET` | *(generate: `openssl rand -base64 32`)* |
| `SESSION_SECRET` | *(same as NEXTAUTH_SECRET or generate another)* |
| `NEXTAUTH_URL` | `https://www.boyanihealth.africandivinechurch.org` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.boyanihealth.africandivinechurch.org` |
| `NEXT_PUBLIC_APP_URL` | `https://www.boyanihealth.africandivinechurch.org` |
| `NODE_ENV` | `production` |

### 3.4 Deploy

Click **Deploy**. Takes 2–5 minutes.

---

## PHASE 4 — Custom Domain and DNS

### 4.1 Add domain in Vercel

1. Project → **Settings → Domains**
2. Add `www.boyanihealth.africandivinechurch.org` → **Add**

Vercel shows required CNAME record:
- `www.boyanihealth` → CNAME → `cname.vercel-dns.com`

### 4.2 Configure DNS at your domain registrar

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| `CNAME` | `www.boyanihealth` | `cname.vercel-dns.com` | 3600 |

---

## RECURRING UPDATES

### A. Update GitHub

```bash
cd "C:/Users/user/Downloads/AfricaDevine/work/Boyani"
git add .
git commit -m "feat: describe your changes here"
git pull origin main --rebase
git push origin main
```

### B. Re-upload the database to Turso

Run only when `prisma/db/custom.db` has changed.

```bash
cd "C:/Users/user/Downloads/AfricaDevine/work/Boyani"
node scripts/turso-upload.js
```

> **Warning:** This replaces ALL database contents in Turso. Any live records
> created since the last upload will be lost.

### C. Quick reference — full update cycle

```bash
# 1. Code changes
git add .
git commit -m "feat: my changes"
git push origin main
# 2. Database changes (only when prisma/db/custom.db changed)
node scripts/turso-upload.js
```

---

## How the Database Connection Works

- **Local development**: `DATABASE_URL="file:./prisma/db/custom.db"` → SQLite
- **Vercel production**: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` → Turso/libsql
- `src/lib/db.ts` checks for `TURSO_DATABASE_URL` first; falls back to SQLite.
- The Prisma schema stays `provider = "sqlite"` — Turso is SQLite-compatible.
