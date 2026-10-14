# Sportmetryx Football
### Live Demo
[**Explore Sportmatryx Football**](https://sportmatryx.vercel.app/)


**Human Performance Intelligence for Football** — *Breathe Smarter. Train Harder.*
Powered by Healthmetryx.

An exception-first, validity-gated athlete readiness platform for football staff, implemented
end-to-end with real authentication, server-enforced RBAC, team-scoped data access, a transparent
scoring engine, tamper-evident audit, and a deterministic synthetic seed.

> **Decision support only. Not a medical device. Prototype models are for research and
> demonstration. All athlete data governed by consent and access controls.**
> All data in this repository is **synthetic** — never real athlete measurements.

---

## 1. What was built

- **Public marketing site** (`/`) with module overview and honest capability labeling
  (ESTABLISHED / DERIVED / PROTOTYPE).
- **Authenticated app** with 12+ working routes:
  `/team-command`, `/roster`, `/player/[id]` (Player 360), `/player/[id]/twin` (Digital Athlete
  Twin), `/position-room`, `/practice-command`, `/game-readiness`, `/recovery-command`,
  `/environment-travel`, `/interventions`, `/data-quality`, `/research`, `/admin`, plus
  `/athlete/[id]/consent` (governance) and `/login`.
- **SMX Performance Index engine** (`src/lib/scoring/`): 7 weighted components, athlete-own-baseline
  normalization (p10–p90), configurable validity gates that **withhold** rather than guess,
  confidence factor, drivers, explicit renormalization only when components are missing
  (marked LIMITED), full provenance persistence.
- **Tamper-evident audit chain** (SHA-256 hash chain, append-only) with live verification endpoint.
- **Real CSV import** with schema validation, frozen metric catalog, range/unit checks, duplicate
  detection, persisted ImportJob with row-level error report.
- **Authorized CSV exports** (team/athlete scope, de-identification option, audit-logged).
- **Intervention review workflow** — approving records a review only; it never messages,
  schedules, or acts (verified by test).
- **Consent governance** — append-only consent changes with mandatory reason; restricted/revoked
  consent withholds scores.

## 2. Repository structure

```
prisma/            schema.prisma (24 entities) + migrations/ + seed.ts (deterministic)
scripts/db.sh      local PostgreSQL 18 lifecycle (init/start/stop/status/reset)
scripts/smoke.sh   20-check Golden Path smoke test against the production build
src/app/           Next.js App Router pages + API route handlers
src/lib/auth/      scrypt password hashing, DB sessions, RBAC capability matrix
src/lib/scoring/   config (weights/thresholds), engine (pure functions), persistence
src/lib/services/  dashboard, athlete, interventions, import, export, audit chain
src/components/    design-system primitives + app widgets (all server/client typed)
tests/             Vitest: scoring engine (28) + RBAC matrix (9)
```

## 3. How to run it

Requirements: Node 18+ (tested on Node 26), pnpm 10+ (tested on pnpm 12). No Docker needed —
the bundled PostgreSQL is downloaded automatically.

```bash
# 1. Install
pnpm install

# 2. Configure environment (first time)
cp .env.example .env            # then set AUTH_SECRET to any 32+ char random string

# 3. Database + schema + seed (one command; starts the bundled Postgres on 127.0.0.1:5432)
pnpm db:setup                   # = db.sh init && start && migrate deploy && seed
# Reset later at any time with: pnpm db:reset && pnpm prisma migrate deploy && pnpm prisma db seed

# 4. Development server
pnpm dev                        # http://localhost:3000

# Production
pnpm build && pnpm start
```

For a **hosted PostgreSQL** instead of the bundled one, set `DATABASE_URL` to your hosted
connection string in `.env` and run `pnpm prisma migrate deploy && pnpm prisma db seed`.

## 4. Demo access (development-only)

Seeded accounts (all use the same password, clearly marked DEV ONLY in the UI):

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@demo.sportmetryx.dev | Demo-SMX-2024! |
| PERFORMANCE | performance@demo.sportmetryx.dev | Demo-SMX-2024! |
| MEDICAL | medical@demo.sportmetryx.dev | Demo-SMX-2024! |
| COACH | coach@demo.sportmetryx.dev | Demo-SMX-2024! |
| EXECUTIVE | executive@demo.sportmetryx.dev | Demo-SMX-2024! |
| ATHLETE | athlete@demo.sportmetryx.dev | Demo-SMX-2024! |

**For production:** rotate/delete these accounts, set a strong `AUTH_SECRET`, and create the first
administrator by registering a user then promoting its role — no backdoor accounts ship in the
schema. Demo passwords are rejected from being reused as documented defaults in production docs.

## 5. Test results (actually executed)

| Command | Result |
|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | ✅ 0 errors |
| `pnpm lint` (`eslint .`) | ✅ 0 errors, 0 warnings |
| `pnpm test` (`vitest run`) | ✅ 37/37 passed (scoring engine + RBAC matrix) |
| `pnpm build` (`next build`) | ✅ compiled successfully, all routes generated |
| `bash scripts/smoke.sh` | ✅ 20/20 Golden Path checks passed |

`scripts/smoke.sh` verifies: DB reachable, server up, unauthenticated redirect, anonymous API 401,
login + wrong-password rejection, dashboard renders seeded roster, withheld view, Player 360
READY + components, EC-11 withheld composite, coach approve rejected (403), performance approve
records a review only (+audit), CSV export (de-identified), hash chain verifies, coach import
rejected, import unit-mismatch rejection.

## 6. Scoring engine semantics (summary)

- 7 components: Respiratory 20% · Oxygen 10% · Recovery 20% · Workload 20% · Movement 15% ·
  Environment 5% · Baseline deviation 10% (default; per-position variants sum to 1.00).
- Normalization uses the **athlete's own 28-day baseline** (min 8 valid observations; below that →
  INSUFFICIENT_BASELINE and the composite is withheld).
- Gates run first and fail closed: consent state, calibration freshness (24h warn / 48h fail),
  sample integrity (valid ratio, signal quality, mask wear), timestamp freshness (36h),
  baseline sufficiency. Two or more failures → MULTI_FAIL → RETEST.
- LOAD_SPIKE (ACWR > 1.5) does **not** withhold — it degrades confidence and warns.
- Missing optional components → explicit renormalization marked **LIMITED** (visible).
- Withheld results: score = null, band WITHHELD, code + reason persisted. Never zero, never an
  estimate. Gaps in trends render as gaps.
- Confidence = calibration × signal × completeness × baseline-maturity (engineering indicator,
  not a calibrated probability).
- All thresholds are PROTOTYPE configuration, editable in `src/lib/scoring/config.ts` and
  persisted per model version for reproducibility.

## 7. Known limitations (honest inventory)

- **No external device integrations.** Ingestion is CSV + manual + synthetic generator. The sensor
  interface is documented (`src/lib/scoring/config.ts` metric catalog) for future adapters.
- **Digital Athlete Twin is a PROTOTYPE** — documented sensitivity curves, clearly labeled
  "hypothetical exploration: not a forecast" everywhere, including the API response.
- **No Playwright e2e** in this environment (headless browser download was not possible in the
  build sandbox). The 20-check smoke script covers the Golden Path at the HTTP level instead;
  `pnpm e2e` is wired and ready once browsers can be installed.
- **Single-tenant demo seed.** The schema supports multiple teams with team-scoped enforcement
  (tested); row-level database security (Postgres RLS) is not enabled — authorization is enforced
  in the application layer for every route and API call.
- **No email verification / MFA / password reset.** Session auth is real (scrypt + DB sessions +
  HMAC-signed cookies) but recovery flows are future work.
- **Report generation** persists Report rows and CSV export works; PDF rendering is not implemented.

## 8. Deployment notes

- Set `DATABASE_URL` (hosted Postgres) and `AUTH_SECRET` (32+ chars). All configuration is
  environment-driven; nothing essential depends on the local filesystem except the bundled dev DB.
- `pnpm build` + `pnpm start` (Node hosting) or any Next.js-compatible host.
- Run `prisma migrate deploy` on release; seed only for demo environments.
- Health-related regulatory review (HIPAA/GDPR and sports-governance rules) is required before any
  real athlete data is used — synthetic data only until then.

## 9. Scripts

| Command | Purpose |
|---|---|
| `pnpm db:setup` | init + start bundled Postgres, migrate, seed |
| `pnpm db:reset` | destroy local DB data (repeatable demo reset) |
| `pnpm db:start` / `db:stop` / `db:status` | Postgres lifecycle |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` / `test` | quality gates |
| `bash scripts/smoke.sh` | Golden Path verification (20 checks) |
