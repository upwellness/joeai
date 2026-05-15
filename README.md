# JoeAI

**LINE OA Sales Intelligence & Customer Payment Bot** — single Next.js app on Vercel.

> Receives LINE webhooks, captures sales-team messages, OCRs customer payment
> slips, matches them against bank statements, and auto-replies with confirmation —
> all from one Vercel deployment, on a 100%-free stack.

---

## Architecture (all serverless, all free tier)

```
LINE
  │
  ▼
┌────────────────────────────────────────┐
│  Vercel — single Next.js deployment    │
│                                        │
│  POST /api/webhook/line                │  ← LINE pushes events here
│       └─→ verify HMAC                  │
│       └─→ publish to QStash            │
│                                        │
│  POST /api/jobs/message-event ◀─┐      │  ← QStash delivers jobs
│  POST /api/jobs/media-download  │      │     (with signature verify)
│  POST /api/jobs/ocr             │      │
│  POST /api/jobs/stt             │      │
│  POST /api/jobs/slip-pipeline   │      │
│  POST /api/jobs/slip-matching   │      │
│                                  │      │
│  GET  /api/messages              │      │  ← Dashboard data API
│  GET  /api/slips ...             │      │
│                                  │      │
│  /dashboard/* (UI)               │      │
└────────────────────────────────────────┘
            │       │       │
            ▼       ▼       ▼
       Neon    Upstash   Cloudflare
      Postgres  QStash       R2
```

### Free-tier summary

| Service | Free quota | Use for |
|---|---|---|
| **Vercel Hobby** | 100 GB-hr functions / 100 GB bandwidth / 6000 build min | host + functions |
| **Neon Postgres** | 0.5 GB storage, 1 project | database |
| **Upstash QStash** | 500 messages/day (~15K/month) | queue |
| **Cloudflare R2** | 10 GB storage, **0 egress fees** | media + slip images |
| **LINE Messaging API** | 200 push msg/month + unlimited webhook | LINE integration |
| **Google Vision OCR** | 1,000 calls/month | OCR (switch from mock when ready) |

> **⚠️ Vercel Hobby ToS:** non-commercial use only. For a real business
> deployment you need the **Pro plan ($20/mo)**. This stack is fine for
> proof-of-concept / personal use / open-source.

---

## Project layout

```
joeai/
├── apps/web/
│   ├── vercel.json                ← Vercel config (Root Directory in UI = apps/web)
│   └── src/
│       ├── app/
│       │   ├── (landing + login)
│       │   ├── dashboard/         ← 5 protected pages
│       │   └── api/
│       │       ├── webhook/line/route.ts        ← LINE entry point
│       │       ├── jobs/<name>/route.ts          ← 6 QStash workers
│       │       ├── auth/{login,logout}/route.ts
│       │       ├── messages/route.ts
│       │       ├── slips/...                     ← list + manual-match + reject
│       │       ├── identities/...                ← list + map
│       │       └── statements/route.ts
│       └── lib/
│           ├── handlers/<name>.ts                ← business logic per job
│           ├── providers/{ocr,stt}.ts            ← swappable providers
│           ├── db.ts, queue.ts, auth.ts, storage.ts
│           └── job-route.ts                       ← QStash signature wrapper
└── packages/
    ├── db/         ← Drizzle schema + migrations + seed (bcryptjs)
    ├── shared/     ← LINE adapter, QStash client, matching algo, env, logger
    └── extractor/  ← Thai-aware slip OCR field extraction
```

---

## Free-tier setup walkthrough

You can spin up the entire stack without any paid signup. Each step has links.

### 1. Neon Postgres

1. Sign up at https://console.neon.tech (free tier auto-applied)
2. Create a new project → pick a region close to you
3. Dashboard → **Connection Details** → copy the **Pooled connection string**
4. Save it — you'll paste it into Vercel env as `DATABASE_URL`

### 2. Upstash QStash

1. Sign up at https://console.upstash.com (free)
2. **QStash** tab → no setup needed; the page shows your credentials
3. Copy three values:
   - `QSTASH_TOKEN` (starts with `eyJ...`)
   - `QSTASH_CURRENT_SIGNING_KEY` (starts with `sig_`)
   - `QSTASH_NEXT_SIGNING_KEY`

### 3. Cloudflare R2

1. Sign up at https://dash.cloudflare.com (free)
2. **R2** in left sidebar → **Purchase R2 plan** (it's $0; just confirms zero billing)
3. **Create bucket** → name it `joeai-media`
4. Bucket → **Settings** → enable **Public access** → enable **R2.dev subdomain**
   - Save the public URL (looks like `https://pub-xxxxxx.r2.dev`)
5. R2 home → **Manage R2 API Tokens** → **Create API Token**:
   - Permission: Object Read & Write
   - Bucket: `joeai-media` (or All buckets)
6. Save **Access Key ID** + **Secret Access Key** + **Account ID** (top right of dashboard)

### 4. LINE Messaging API

1. Sign up at https://developers.line.biz/console/ (free)
2. **Create a new provider** → **Create a Messaging API channel**
3. Channel → **Basic settings** → copy `Channel secret`
4. Channel → **Messaging API** → **Issue a long-lived channel access token**
5. **Disable** "Auto-reply messages" and "Greeting messages" (we reply via our own logic)
6. Note: you'll set the webhook URL in Step 6 below, after Vercel deploys

### 5. Vercel project

1. Sign up at https://vercel.com → **Add New → Project**
2. Import `upwellness/joeai` from GitHub
3. **Set:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web` ← **critical**
   - Build / Install / Output: leave blank (Override OFF)
4. **Environment Variables** (Settings → Environment Variables):

   ```
   DATABASE_URL              <from Neon step 1>
   LINE_CHANNEL_SECRET       <from LINE step 3>
   LINE_CHANNEL_ACCESS_TOKEN <from LINE step 4>
   QSTASH_TOKEN              <from Upstash step 2>
   QSTASH_CURRENT_SIGNING_KEY  <from Upstash step 2>
   QSTASH_NEXT_SIGNING_KEY     <from Upstash step 2>
   R2_ACCOUNT_ID             <from Cloudflare step 3>
   R2_ACCESS_KEY_ID          <from Cloudflare step 3>
   R2_SECRET_ACCESS_KEY      <from Cloudflare step 3>
   R2_BUCKET                 joeai-media
   R2_PUBLIC_URL_BASE        <https://pub-xxxxxx.r2.dev>
   APP_BASE_URL              <https://your-vercel-domain.vercel.app>
   AUTH_SECRET               <output of: openssl rand -hex 32>
   OCR_PROVIDER              mock
   STT_PROVIDER              mock
   ```

5. **Deploy.** Wait for green check.

### 6. First-run DB setup

From your laptop (one-time):

```bash
cd joeai
git pull
pnpm install

export DATABASE_URL="<the Neon pooled URL>"

pnpm db:migrate    # creates 11 tables
pnpm db:seed       # creates 4 users + 1 customer (password: changeme)
```

### 7. Point LINE at Vercel

1. LINE Developer Console → your channel → **Messaging API**
2. **Webhook URL:** `https://<your-vercel-domain>/api/webhook/line`
3. **Use webhook:** ON
4. Click **Verify** — must return Success (200)

### 8. Log in

Open `https://<your-vercel-domain>/login`:

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `changeme` | admin (all pages) |
| `joe@example.com` | `changeme` | sale |
| `naree@example.com` | `changeme` | manager |
| `accounting@example.com` | `changeme` | accounting |

⚠️ **Change the default passwords** before showing this to anyone. There's no UI for it yet — use `pnpm db:studio` or Neon's SQL editor and run:
```sql
UPDATE employees SET password_hash = '$2a$12$...' WHERE email = 'admin@example.com';
```

---

## Local dev

```bash
cp .env.example .env.local      # fill in same values as Vercel
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev                         # http://localhost:3000
```

For LINE / QStash callbacks to reach localhost, use a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# → https://random.trycloudflare.com
# set APP_BASE_URL to that URL in .env.local
# update LINE webhook URL to https://random.trycloudflare.com/api/webhook/line
```

---

## LINE limitations (must read)

LINE Official Accounts only receive group/room events when:
- The bot is **mentioned** (`@YourBot`), OR
- A user **replies** to a bot message

If you need to capture *every* group message, use **LINE Works** instead.
The architecture is channel-agnostic — only the webhook adapter would change.

---

## Workspace scripts

```bash
pnpm dev          # Next.js dev server
pnpm build        # Production build
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # vitest run, all packages

pnpm db:generate  # produce SQL from Drizzle schema diff
pnpm db:migrate   # apply migrations
pnpm db:seed      # seed sample employees + customer
pnpm db:studio    # open Drizzle Studio
```

---

## Tested business logic

```bash
pnpm --filter @joeai/shared test
pnpm --filter @joeai/extractor test
```

45 tests covering:
- **Slip matching** (17 tests) — reference match, amount+time, amount-only, race conditions, multi-candidate ambiguity
- **LINE webhook signature** (6 tests) — HMAC-SHA256, timing-safe compare, body tampering
- **Thai date parsing** + **slip field extraction** (22 tests) — Buddhist Era → A.D., Thai month abbrevs, multi-bank slip variants

---

## Production readiness checklist

This repo is a **bootstrap scaffold**. Before going to production:

- [ ] Move to Vercel Pro ($20/mo) for commercial use + region pinning + longer timeouts
- [ ] Decide LINE OA vs LINE Works (group capture limitation)
- [ ] Wire a real OCR provider (Google Vision 1K free/mo, Typhoon, etc) — currently `mock`
- [ ] Wire a real STT provider — currently `mock`
- [ ] Add bank-specific statement parsers (KBank, SCB, BBL, ...)
- [ ] Implement PDPA consent flow before deploying bot to a real LINE group
- [ ] Add audit log UI + password reset UI
- [ ] Rate-limit `/api/webhook/line` at the Vercel edge / Cloudflare
- [ ] Set up Vercel monitoring / Slack alerts on function errors

---

## Tech docs

- [`PRD_LINE_OA_Sales_Bot.md`](../PRD_LINE_OA_Sales_Bot.md) — product requirements
- [`TECH_SPEC_LINE_OA_Sales_Bot.md`](../TECH_SPEC_LINE_OA_Sales_Bot.md) — technical specification

---

## License

UNLICENSED — internal use only.
