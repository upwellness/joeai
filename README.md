# JoeAI

**LINE OA Sales Intelligence & Customer Payment Bot**

A monorepo for ingesting LINE messages from a sales team, OCR'ing customer payment slips, matching them against bank statements, and replying automatically — with a unified dashboard.

---

## What's in here

```
joeai/
├── apps/
│   ├── webhook/   # Fastify — receives LINE webhook events, enqueues to Redis
│   ├── worker/    # BullMQ workers — media DL, OCR, STT, slip matching
│   ├── api/       # Fastify — dashboard REST API (auth, RBAC, queries)
│   └── web/       # Next.js 15 — dashboard UI
├── packages/
│   ├── db/        # Drizzle ORM schema + migrations + client
│   ├── shared/    # LINE adapter, queue helpers, matching algorithm, env, logger
│   └── extractor/ # Slip OCR field extraction (regex-based, Thai-aware)
├── docker/
│   └── docker-compose.yml   # Postgres + Redis + MinIO for local dev
└── .github/workflows/ci.yml # GitHub Actions
```

## Stack

- **Node 22** + **TypeScript 5.7** (ESM)
- **Fastify 5** for HTTP services
- **BullMQ** + **Redis 7** for queues
- **PostgreSQL 16** + **Drizzle ORM**
- **Next.js 15** (App Router) + **Tailwind**
- **Vitest** for tests
- **pnpm 10** workspaces
- **Docker Compose** for local infra

---

## Quick start

```bash
# 0. Prereqs: Node 22+, pnpm 10+, Docker
corepack enable
corepack prepare pnpm@10.0.0 --activate

# 1. Install deps
pnpm install

# 2. Start infra (Postgres + Redis + MinIO)
pnpm docker:up

# 3. Copy env + edit secrets
cp .env.example .env
# Open .env and fill in LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, AUTH_SECRET

# 4. Generate + run DB migrations
pnpm db:generate
pnpm db:migrate

# 5. Optional seed
pnpm db:seed

# 6. Run everything in dev mode
pnpm dev
```

Services bind to:

| Service  | Port | URL                                    |
| -------- | ---- | -------------------------------------- |
| web      | 3000 | http://localhost:3000                  |
| webhook  | 3001 | http://localhost:3001/webhook/line     |
| api      | 3002 | http://localhost:3002/api/...          |
| postgres | 5432 | -                                      |
| redis    | 6379 | -                                      |
| minio    | 9000 | http://localhost:9001 (console: minioadmin/minioadmin) |

---

## LINE setup (development)

1. Create a LINE Messaging API channel at https://developers.line.biz/console/
2. Get **Channel secret** and **Channel access token (long-lived)**
3. Put them in `.env`
4. Expose your local webhook to LINE — use **ngrok** or **cloudflared**:
   ```bash
   cloudflared tunnel --url http://localhost:3001
   # → https://random.trycloudflare.com
   ```
5. Set webhook URL in LINE console:  
   `https://random.trycloudflare.com/webhook/line`
6. Verify in LINE console — should respond 200.

### ⚠️ LINE group limitation

LINE Official Accounts only receive group/room events when:

- The bot is **mentioned** (e.g. `@SalesBot`), OR
- A user **replies** to a bot's message

This is a hard limitation of LINE OA. If you need to capture *every* group message, migrate to **LINE Works** (the bot core is channel-agnostic).

See [`TECH_SPEC`](../TECH_SPEC_LINE_OA_Sales_Bot.md) §3.4 for details and onboarding mitigations.

---

## Workspace scripts

```bash
pnpm dev          # all apps in parallel watch mode
pnpm build        # build all packages and apps
pnpm typecheck    # tsc --noEmit everywhere
pnpm test         # vitest run, all packages
pnpm lint         # whatever each package defines

pnpm db:generate  # produce SQL from drizzle schema diff
pnpm db:migrate   # apply migrations
pnpm db:seed      # seed sample employees + customer

pnpm docker:up    # start postgres + redis + minio
pnpm docker:down
pnpm docker:logs
```

---

## Architecture (high level)

```
LINE
  │
  ▼
[webhook]  ── signature verify ── BullMQ ──┐
                                            │
                              ┌─────────────┼─────────────┐
                              ▼             ▼             ▼
                       [message-event]  [media-download]  [slip-pipeline]
                              │             │             │
                              │             ▼             ▼
                              │           [S3]         [ocr]
                              ▼                         │
                          [Postgres]                    ▼
                                                   [matching]
                                                       │
                                                       ▼
                                                  reply via LINE

[api] ◀──── [web (Next.js)]
   │
   ▼
[Postgres]
```

For full design: see `../TECH_SPEC_LINE_OA_Sales_Bot.md` (companion doc).

---

## Tested business logic

Slip matching is the highest-risk piece and has full unit coverage:

```bash
pnpm --filter @joeai/shared test
pnpm --filter @joeai/extractor test
```

Covers:
- Reference number matching (tier 1)
- Amount + time-window matching (tier 2)
- Amount-only matching (tier 3, low confidence)
- Race conditions on transaction claim
- Thai date parsing (Buddhist Era → A.D.)
- Thai bank slip field extraction (amount, datetime, ref, bank)
- LINE webhook signature verification (HMAC-SHA256, timing-safe)

---

## Production readiness checklist

This repo is a **bootstrap scaffold**. Before going to production you must:

- [ ] Decide LINE OA vs LINE Works (see TECH_SPEC §3.4)
- [ ] Wire a real OCR provider (Google Vision / Typhoon) and validate Thai accuracy
- [ ] Wire a real STT provider (Whisper local or Google STT)
- [ ] Add bank-specific statement parsers (KBank, SCB, BBL, ...)
- [ ] Implement PDPA consent flow (R6.1 in PRD)
- [ ] Add full audit log UI
- [ ] Configure CloudFront/Cloudflare in front of webhook
- [ ] Set up RDS/ElastiCache/S3 (or equivalents)
- [ ] Add Prometheus metrics + Grafana dashboards
- [ ] Set up alerts (PagerDuty/Slack)
- [ ] Run load test (target: 100 webhook/sec, p95 < 1s)
- [ ] Security review (especially S3 ACLs and audit log retention)

---

## Tech docs

- [`PRD_LINE_OA_Sales_Bot.md`](../PRD_LINE_OA_Sales_Bot.md) — product requirements
- [`TECH_SPEC_LINE_OA_Sales_Bot.md`](../TECH_SPEC_LINE_OA_Sales_Bot.md) — technical specification

---

## Contributing

```bash
# Branch off main
git checkout -b feat/your-feature

# Hack, commit, push
pnpm typecheck && pnpm test
git push -u origin feat/your-feature

# Open a PR
gh pr create
```

CI runs typecheck + tests against Postgres + Redis services on every PR.

> **First-time setup:** the CI workflow ships as `ci-templates/ci.yml`
> because the bootstrap push used an OAuth token without the `workflow` scope.
> Enable it once:
>
> ```bash
> gh auth refresh -h github.com -s workflow    # one-time, interactive
> mkdir -p .github/workflows
> git mv ci-templates/ci.yml .github/workflows/ci.yml
> git commit -m "ci: enable GitHub Actions workflow"
> git push
> ```

---

## License

UNLICENSED — internal use only.
