# JoeAI

**LINE OA Sales Intelligence & Customer Payment Bot** — single Next.js app on Vercel.

> Receives LINE webhooks, captures sales-team messages, OCRs customer payment
> slips, matches them against bank statements, and auto-replies with confirmation —
> all from one Vercel deployment.

---

## Architecture (all Vercel, all serverless)

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
       Neon     Upstash  Vercel
      Postgres  QStash    Blob
```

**External services (all have free tiers):**
- **Neon** or **Vercel Postgres** — managed Postgres
- **Upstash QStash** — HTTP-based queue (replaces BullMQ on serverless)
- **Vercel Blob** — media + slip image storage
- **LINE Messaging API** — webhook + push reply

---

## Project layout

```
joeai/
├── apps/web/
│   └── src/
│       ├── app/
│       │   ├── (landing + login)
│       │   ├── dashboard/        ← 5 protected pages
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
│           ├── db.ts, queue.ts, auth.ts, blob.ts
│           └── job-route.ts                       ← QStash signature wrapper
├── packages/
│   ├── db/         ← Drizzle schema + migrations + client
│   ├── shared/     ← LINE adapter, QStash client, matching algo, env, logger
│   └── extractor/  ← Thai-aware slip OCR field extraction
└── vercel.json
```

---

## Quick start (local dev)

```bash
# 0. Prereqs: Node 22+, pnpm 10+
corepack enable
corepack prepare pnpm@10.0.0 --activate

# 1. Install
pnpm install

# 2. Spin up local Postgres (or point DATABASE_URL at Neon dev branch)
# Easiest: use Neon's free tier and grab the connection string.

# 3. Copy env + edit
cp .env.example .env.local
# Fill DATABASE_URL, LINE_*, QSTASH_*, BLOB_READ_WRITE_TOKEN, AUTH_SECRET

# 4. DB migrate + seed
pnpm db:migrate
pnpm db:seed       # adds sample employees + customer

# 5. Run dev server
pnpm dev           # http://localhost:3000

# 6. (Optional) tunnel for LINE / QStash callbacks
cloudflared tunnel --url http://localhost:3000
# Set APP_BASE_URL to the https URL it prints
```

---

## Deploying to Vercel

1. **Connect repo** — go to https://vercel.com/new → import `upwellness/joeai`
2. **Pick Next.js preset** (auto-detected via `vercel.json`)
3. **Add integrations** in the Vercel project:
   - **Neon Postgres** (or Vercel Postgres) → auto-sets `DATABASE_URL`
   - **Upstash QStash** → auto-sets `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
   - **Vercel Blob** → auto-sets `BLOB_READ_WRITE_TOKEN`
4. **Add the remaining env vars** in Settings → Environment Variables:
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `AUTH_SECRET` (generate: `openssl rand -hex 32`)
   - `APP_BASE_URL` = `https://<your-prod-domain>` (overrides `VERCEL_URL` fallback)
   - `OCR_PROVIDER` / `STT_PROVIDER` (start with `mock`, switch later)
5. **Deploy.**
6. **Run the migration once** against prod Postgres:
   ```bash
   DATABASE_URL="<prod-url>" pnpm db:migrate
   ```
7. **Set the LINE webhook URL** in LINE Console:
   `https://<your-prod-domain>/api/webhook/line`
8. **Verify** in LINE Console — should respond 200.

---

## LINE setup

1. Create a Messaging API channel at https://developers.line.biz/console/
2. Get **Channel secret** + **Channel access token (long-lived)** → put in env
3. Set webhook URL to `https://<your-domain>/api/webhook/line`
4. Disable "Auto-reply messages" in LINE Console (we reply via our own logic)

### ⚠️ LINE group limitation

LINE Official Accounts only receive group/room events when:
- The bot is **mentioned** (`@SalesBot`), OR
- A user **replies** to a bot message

If you need to capture *every* group message, you must use **LINE Works** instead.
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

- [ ] Decide LINE OA vs LINE Works (group capture limitation)
- [ ] Wire a real OCR provider (Google Vision / Typhoon) — currently `mock`
- [ ] Wire a real STT provider — currently `mock`
- [ ] Add bank-specific statement parsers (KBank, SCB, BBL, ...)
- [ ] Implement PDPA consent flow before deploying bot to a real LINE group
- [ ] Add audit log UI
- [ ] Rate-limit `/api/webhook/line` at the Vercel edge / Cloudflare
- [ ] Set up Vercel monitoring / Slack alerts on function errors
- [ ] Load test (target: 100 webhook/sec, p95 < 1s)

---

## Tech docs

- [`PRD_LINE_OA_Sales_Bot.md`](../PRD_LINE_OA_Sales_Bot.md) — product requirements
- [`TECH_SPEC_LINE_OA_Sales_Bot.md`](../TECH_SPEC_LINE_OA_Sales_Bot.md) — technical specification

---

## License

UNLICENSED — internal use only.
