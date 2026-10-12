# SPORTMETRYX — ULTIMATE BUILD PROMPT
Paste this whole file into Claude Code (or Cursor / Lovable / Codex) at the root of an empty repo. Attach the 9 reference screenshots and, if you can, the design canvas boards (export as images or PDF) and `SPX_Dashboard_Variables_V_1.docx`.

---

## 0. YOUR ROLE AND HOW TO WORK

You are a principal full-stack engineer and product designer. Build **Sportmetryx Football, powered by Healthmetryx**, a production-grade, multi-tenant web application with two connected products:

1. **Sportmetryx Football**: an exception-first, validity-gated athlete readiness platform for football staff (the "Team Command" product).
2. **Sportmetryx Metabolic Data Marketplace**: a marketplace where athletes own, price and sell metabolic and respiratory data sets to subscribers, media and advertisers.

Working rules:
- Work in **phases** (section 16). After each phase: run lint, type-check and tests, summarize what exists, list assumptions, and **stop and ask** before starting the next phase.
- Never invent clinical claims. This is **decision support, not a medical device**.
- Prefer boring, well-typed, tested code. No dead code, no TODO stubs that pretend to work. If something is mocked, label it `PROTOTYPE` in the UI and in code.
- Ask me at most one question at a time, and only if you are blocked. Otherwise choose the documented default (section 17) and continue.

---

## 1. VISUAL REFERENCES (MATCH THESE)

The screenshots are AI-generated concept art. **Match layout, hierarchy, color, density and component behavior. Ignore garbled or misspelled labels** (for example "Conneat Drektop", "Wouider Explorer", "Rostermitry", "Soriting"). Use the correct names from this prompt.

| File | Screen | What to copy |
|---|---|---|
| `1.jpg` | Brand imagery collage | Night-stadium photography with cyan data-line overlays. Use as hero and empty-state background art. Blurred, darkened, low opacity behind panels. |
| `6.jpg` | Landing page | Hero "Off season. On another level.", telemetry rail on the right, credibility strip, left icon rail plus collapsible nav. |
| `3.jpg` | Roster Mission Control (`/team-command`) | Summary strip, filter bar, roster grid with withheld stamps, exception drawer on the right. |
| `4.jpg` | Intervention Queue | Human-review banner, 3 stat cards, tabs, table with Approve / Dismiss / Snooze. |
| `2jpg.jpg` | SMX Performance Index Explorer | Athlete select, preset selector, 7 weight sliders locked to 100%, hero index, drivers, component breakdown with sparklines. |
| `5.jpg` | Digital Athlete Twin | Baseline band chart, response curve, trajectory strip, scenario compare panel with deltas. |
| `7.jpg` | Governance and Consent | Granted / Restricted / Revoked, change form with required reason, tamper-evident hash-chain audit trail. |
| `8.jpg` | Identity Providers and SCIM | Okta OIDC and Entra SAML cards, group-to-role mapping, session policy, MFA per role, SCIM token controls, step-up banner. |
| `10.jpg` | Device Registry and Calibration | Partner onboarding, cross-tenant device table with calibration freshness, callout. |

Global visual rules (all screens):
- **Dark command-center UI.** Canvas `#0A1220`, panel `#101B2E`, border `#1E2D45`, text `#E6EEF8`, muted `#8FA3BD`.
- Status colors: Ready / accent `#22D3EE`, Monitor `#F5B83D`, Compromised `#F0616D`, Withheld `#8FA3BD` (dashed outline), Prototype tag `#8B5CF6`, positive driver `#34D399`.
- Fonts: **Barlow Condensed** (headings, hero numbers, uppercase) and **Barlow** (body). Tabular numerals for all scores.
- Faint athlete-silhouette and grid background image at ~6% opacity behind pages.
- Every page footer, verbatim: *"Decision support only. Not a medical device. Prototype models are for research and demonstration. © Sportmetryx. All athlete data governed by consent and access controls."*
- Header: brand lockup "SPORTMETRYX™ FOOTBALL — Powered by Healthmetryx™", breadcrumb with the route path, **Role Switcher** dropdown top right.
- Every number shows an **evidence status tag**: `ESTABLISHED`, `DERIVED` or `PROTOTYPE`, plus a confidence value where applicable.
- Accessibility: WCAG AA contrast, real `<button>`/`<a>`/`<label>` elements, visible focus rings, keyboard-operable sliders and tables, `aria-label` on icon buttons. Never rely on color alone: pair color with text or icon.

---

## 2. TECH STACK (FIXED)

- **Monorepo** (pnpm workspaces + Turborepo): `apps/web` (Next.js), `apps/worker` (queue workers), `packages/db`, `packages/scoring`, `packages/ui`, `packages/contracts` (Zod schemas shared by API and UI), `packages/config`.
- **Next.js 15 App Router**, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui, Radix primitives, lucide-react icons, Recharts (charts) and a small custom SVG layer for sparklines and band charts.
- State and data: TanStack Query, TanStack Table, Zustand (UI state only), React Hook Form + Zod.
- Backend: Next.js route handlers (REST, JSON) with a thin service layer. Zod validation on every input and output.
- DB: **PostgreSQL 16** with **Prisma**; **row-level security** by `tenant_id`. Redis + **BullMQ** for ingestion, scoring and report jobs. S3-compatible object storage for uploads and exports.
- Auth: **Auth.js (NextAuth v5)** with Okta OIDC, Entra ID SAML 2.0 (via a SAML bridge such as BoxyHQ SAML Jackson), email magic-link for athletes, TOTP MFA, step-up auth. **SCIM 2.0** server endpoints.
- Payments (marketplace): **Stripe Connect** (test mode).
- Observability: OpenTelemetry, structured JSON logs, Sentry hook (disabled by default).
- Tests: Vitest (unit), Playwright (e2e), MSW (mocks), Testcontainers (integration with Postgres). GitHub Actions CI.
- Dev: Docker Compose for Postgres, Redis, MinIO, Mailpit. One command: `pnpm dev`. One command to seed: `pnpm db:seed`.

---

## 3. USERS, ROLES AND PERMISSIONS (RBAC, ENFORCED SERVER-SIDE)

Football product roles: `EXECUTIVE`, `MEDICAL`, `PERFORMANCE`, `COACH`, `ATHLETE`, `INTERNAL_ADMIN`.
Marketplace roles: `ATHLETE`, `SUBSCRIBER` (teams, agents, clinics, researchers, device makers), `MEDIA`, `ADVERTISER`, `MARKETPLACE_ADMIN`.
A user can hold one role per tenant. The header **Role Switcher** switches among roles the user actually has (demo mode may allow all roles on the seeded demo tenant only).

Permission matrix (minimum):

| Capability | EXEC | MED | PERF | COACH | ATHLETE | INT_ADMIN |
|---|---|---|---|---|---|---|
| View roster, indices | yes | yes | yes | yes | self only | no |
| Index Explorer, Twin | yes | yes | yes | read only | self, read only | no |
| Approve / dismiss / snooze interventions | yes | yes | yes | no | no | no |
| Change consent state | yes | yes | no | no | self | no |
| Identity, SSO, SCIM, session policy | yes | no | no | no | no | no |
| Export de-identified cohort data | yes | yes | no | no | no | no |
| Device registry (cross-tenant) | no | no | no | no | no | yes |

Rules: MFA **required** for EXECUTIVE and MEDICAL. Settings changes require **step-up authentication** and write an immutable audit record. Deny by default. Every route handler calls a single `authorize(user, action, resource)` function; test it exhaustively.

---

## 4. DOMAIN MODEL (PRISMA)

Create these models with sensible indexes, `tenantId` on every tenant-scoped table, `createdAt/updatedAt`, soft delete where noted.

**Tenancy and identity:** `Tenant(slug, plan, dataRegion, retentionDays)`, `User(email, role, mfaEnrolled, deletedAt)`, `IdentityProvider(type OIDC|SAML, issuer, clientId, encryptedSecret, jitEnabled, active)`, `GroupRoleMapping(idpGroup, role)`, `ScimToken(hash, last4, rotatedAt, revokedAt)`, `SessionPolicy(maxLifetimeHours, idleTimeoutMinutes, mfaRoles[])`.

**Athletes and sport context:** `Athlete(tenantId, externalId e.g. "EC-10", displayName, positionGroup QB|SKILL|TRENCH|HYBRID|SPECIAL_TEAMS, position, scoringModelId, consentState)`, `Team`, `Season`.

**Consent and audit:** `ConsentRecord(athleteId, state GRANTED|RESTRICTED|REVOKED, reasonCode, reasonText, actorId)`, `AuditRecord(tenantId, seq, event, actorId, actorRole, entityType, entityId, snapshot JSON, reasonCode, ip, prevHash, hash)` with a unique `(tenantId, seq)`. **Append-only** (enforce with a DB trigger that rejects UPDATE and DELETE).

**Devices and ingestion:** `DeviceModel(name, kind RESPIRATORY_MASK|WEARABLE_CHEST_STRAP|ENVIRONMENTAL_STATION|SYNTHETIC, partner, capabilityDescriptor JSON, version)`, `Device(tenantId, modelId, firmware, firmwareChannel STABLE|PINNED|BETA, status ACTIVE|OFFLINE|ERROR, lastIngestAt, calibrationStatus FRESH|AGING|STALE|FAILED|EXPIRED, calibratedAt)`, `Session(athleteId, deviceId, startedAt, endedAt, venue, indoor, geoTrack)`, `MetricSample(sessionId, metricKey, value, unit, ts, signalQuality, source)`, `MetricCatalogEntry` (frozen catalog: key, unit, valid range, kind), `RejectedSample(reason)`.

**Scoring:** `ScoringModel(name e.g. "SMX-DEFAULT", "SMX-SKILL", weights JSON, version, evidenceStatus)`, `Baseline(athleteId, metricKey, p10, p50, p90, n, windowDays)`, `ComponentScore(athleteId, ts, component, score 0..1, evidenceStatus)`, `IndexResult(athleteId, ts, value nullable, band READY|MONITOR|COMPROMISED|WITHHELD, confidence, withheldCode nullable, modelVersion, weightsSnapshot JSON, drivers JSON, provenance JSON)`, `Exception(athleteId, code, severity CRITICAL|HIGH|MODERATE, openedAt, resolvedAt, evidence JSON)`, `Intervention(exceptionId, athleteId, actionType, recommendedReview, status SUGGESTED|APPROVED|DISMISSED|SNOOZED, suggestedWindow, snoozedUntil, reviewedById)`.

**Marketplace:** `DataSet(ownerAthleteId, category, title, fields[], qualityScore, sampleRows, identityMode NAMED|ANONYMIZED)`, `Listing(dataSetId, method FIXED|SUBSCRIPTION|BUNDLE|POOLED|BUYER_REQUEST|TIME_LIMITED, priceCents, currency, allowedBuyerTypes[], status)`, `AccessRequest(listingId, buyerId, purpose, proposedTerms, status PENDING|APPROVED|COUNTERED|DECLINED)`, `License(dataSetId, buyerId, purpose, startsAt, endsAt, status, withdrawnAt)`, `Order(buyerId, totalCents, status)`, `OrderItem`, `Payment(stripeIntentId, status)`, `Payout(athleteId, amountCents, status)`, `Wallet`, `Campaign(advertiserId, budgetCents, startsAt, endsAt, status DRAFT|IN_REVIEW|APPROVED|RUNNING|ENDED)`, `Placement`, `Sponsorship`, `Story`, `RankingTable`, `ResearchStudy(ethicsStatus)`, `ApiKey(hash, last4, env LIVE|TEST)`, `SavedSearch`.

Config table `PlatformConfig` holds **platform fee**, ad revenue split, band cutoffs and minimum group size. All are unset or defaulted (section 17), editable by `MARKETPLACE_ADMIN`/`EXECUTIVE`, and audited.

---

## 5. SCORING ENGINE (`packages/scoring`, PURE FUNCTIONS, 100% UNIT-TESTED)

### 5.1 The seven components (score 0 to 1 each)
1. Respiratory Efficiency
2. Oxygen Function
3. Recovery and Autonomic State
4. Workload Response
5. Movement / Explosive
6. Environment and Travel
7. Individual Baseline Deviation

### 5.2 Weights
Default model `SMX-DEFAULT`: respiratory 0.20, oxygen 0.10, recovery 0.20, workload 0.20, movement 0.15, environment 0.05, baseline deviation 0.10 (sum = 1.00).
Position model `SMX-SKILL`: respiratory 0.18, oxygen 0.10, recovery 0.18, workload 0.20, movement 0.22, environment 0.05, baseline deviation 0.07 (sum = 1.00).
Provide `SMX-TRENCH`, `SMX-QB`, `SMX-HYBRID`, `SMX-ST` as clearly labeled `PROTOTYPE` variants. A Zod refinement rejects any weight set that does not sum to 1.00 (tolerance 0.001). **Always display the weights actually used.**

### 5.3 Index
`index = round(100 * Σ (weight_i * score_i), 1)`; contribution_i = `100 * weight_i * score_i` (this is what the Explorer's CONTRIBUTION column shows; e.g. 0.84 × 20% → 16.8).
Worked example to encode as a test: scores .84/.91/.78/.80/.82/.50/.94 with default weights → contributions 16.8, 9.1, 15.6, 16.0, 12.3, 2.5, 9.4 → **index 81.7** (note: round per component only for display; document the rounding rule and make the test explicit). The mockup shows 81.4; treat that as illustrative and do not hard-code it.

### 5.4 Component scoring is baseline-first
Each athlete has a rolling baseline per metric (default 28-day window, minimum n = 8 valid sessions, else mark `INSUFFICIENT_BASELINE` and fall back to a position-group prior with confidence capped at 60%). Map a raw value x to a score with the athlete's own p10–p90: `s = clamp((x − p10) / (p90 − p10), 0, 1)`; invert for metrics where lower is better. **Individual Baseline Deviation** scores how close today is to the athlete's own p50 (closer is higher).

### 5.5 Validity gates (run BEFORE scoring; fail closed)
Any failed gate **withholds** the score (value `null`, band `WITHHELD`) with a code. Never output 0 or an estimate.
- `CALIBRATION_STALE`: device calibration older than 24 h (High). Calibration older than 48 h or `FAILED`/`EXPIRED` raises it and may combine into MULTI_FAIL.
- `CONSENT_RESTRICTED`: consent state `RESTRICTED` or `REVOKED` (High).
- `SAMPLE_INTEGRITY_LOW`: valid-sample ratio, signal quality or mask-wear time below thresholds.
- `MULTI_FAIL`: two or more gates failed (Critical). Show the list of failed checks.
- `LOAD_SPIKE`: acute:chronic workload ratio > 1.5 → **does not withhold**; produces a `MODERATE` exception and **degrades** confidence (as in the roster screenshot).
Every withhold writes provenance (which gate, which input, which threshold).

### 5.5.1 Bands
Defaults (configurable): `READY` ≥ 70, `MONITOR` 40–69.9, `COMPROMISED` < 40, `WITHHELD` when gated. Display the band pill with text, never color alone.

### 5.6 Confidence (0–100%)
`confidence = 100 × calibrationFreshness × signalQuality × dataCompleteness × baselineMaturity`, each factor 0..1, documented in code, displayed with a ring (cyan ≥ 90, amber 70–89, red < 70). Degraded confidence is visible on the roster ring and in the Explorer.

### 5.7 Drivers ("why before what to do")
For each result compute each component's **delta vs the athlete's own baseline contribution**; return the top 3 positive and top 3 negative drivers with human text, e.g. "HRV +12% vs baseline", "Heat index 36°C penalty". Store in `IndexResult.drivers`.

### 5.8 Digital Athlete Twin simulation (`POST /api/twin/simulate`)
Inputs: `tzShiftHours (−12..12)`, `heatIndexC (0..55)`, `aqi (0..300)`, `altitudeM (0..4000)`, `sleepHours (0..12)`, `practiceLoadPct (50..200)`. Use transparent, documented sensitivity curves per component (monotonic, bounded, in a config file with unit tests), apply them to a copy of today's component scores, recompute the index through the same engine, and return base index, simulated index, delta and per-component deltas. Hard rules: the response includes `"disclaimer": "Hypothetical exploration: not a forecast"`, the UI always shows that banner in amber, and no endpoint named or described as "predict".

### 5.9 Determinism and provenance
Every `IndexResult` stores the model version, weights snapshot, inputs hash and gate results. A **Trace Provenance** action opens `/system/validity/[athleteId]` showing exactly how a number was produced and links to the audit chain.

---

## 6. APPLICATION MAP (ROUTES) AND SCREEN SPECS

Use a shared **AppShell**: collapsible left nav, header (brand, breadcrumb path in monospace, Role Switcher), page container, global footer disclaimer, toast region, command palette (`Ctrl/⌘+K`).

### 6.1 `/` Landing (ref `6.jpg`)
Left icon rail (home, dashboard, people, data, settings, logout) + collapsible nav (Overview: Landing, Events; Company; Support). Hero: label "SPORTMETRYX™ FOOTBALL", headline "OFF SEASON." (white) + "ON ANOTHER LEVEL." (cyan, glow), sub "BREATHE SMARTER. TRAIN HARDER.", copy "Measure the athlete. Understand the workload. Predict performance degradation. Protect availability." (keep this exact marketing line but never imply clinical prediction in product screens). Buttons: "Enter the platform" (primary) and "See the architecture". Right: **HeroTelemetryRail** with 7 cards (heart rate 72 bpm Zone 2, blood oxygen 98% Normal, respiratory rate 16 rpm Optimal, air quality AQI 12 Good, training load 8.5 High, performance trend Improving, recovery 92% ring), each with a mini sparkline and a `PROTOTYPE` tag; caption "Illustrative telemetry. Prototype models. Not a medical device." Bottom **credibility strip** of 5 claims with `ESTABLISHED` / `DERIVED` tags. Data is mocked from a seeded generator, animated gently.

### 6.2 `/team-command` Roster Mission Control (ref `3.jpg`)
- **RosterSummaryStrip**: counts Ready / Monitor / Compromised / Withheld and "N active exceptions (critical and high)". Clicking a count filters the grid.
- **RosterFilterBar**: position group segmented control (All, QB, SKILL, TRENCH, HYBRID, SPECIAL_TEAMS), severity checkboxes (Critical, High, Moderate), free-text search, view toggle (All Athletes / Exceptions Only / Withheld Only), Reset Filters. Filters live in the URL.
- **RosterGrid** (virtualized, sortable): Athlete Name, Position, Group, Latest Index, Band, Confidence ring, 14-day Trend sparkline, Exceptions pill ("4 EXCEPTIONS"), Last Updated. Default sort: exception severity desc, then index asc. **Withheld rows** show a stamped `WITHHELD` (or `WITHHELD / RETEST`) badge, em-dash for band and confidence, and a **gapped** sparkline (dashes, never zero). Critical row has a red left border. Row click → `/team-command/player/[id]`.
- **ExceptionDrawer** (right, closable): ranked active exceptions with code, severity pill, one-line reason; click scrolls and highlights the row.
- Real-time: server-sent events or polling every 30 s for updates; "Updated 20 mins ago" text uses relative time.

### 6.3 `/team-command/interventions` (ref `4.jpg`)
Amber banner: "Suggestions require human review. Approving an item records a review; it does not message, schedule, or act. No action is taken automatically." Three stat cards (Active Suggestions, Resolved This Week, Snoozed). Tabs: All Suggested, Approved, Snoozed, Dismissed with counts; Severity and Action Type filters. Table columns: Athlete, Exception/Key, Recommended Review, Status (pulse animation on the newest SUGGESTED), Suggested Window, Evidence, Actions (Approve / Dismiss / Snooze 24h; snoozed rows show Restore). Actions call `POST /api/interventions/:id/{approve|dismiss|snooze|restore}`, are optimistic with rollback, and each writes an **AuditRecord**. **Approve must never trigger any outbound message or scheduling.** Test this.

### 6.4 `/intelligence/performance-index` Explorer (ref `2jpg.jpg`)
- Left: athlete select, **Preset selector** (Prototype Default, Recovery Emphasis, Workload Emphasis) with `PROTOTYPE: Presets are illustrative, not clinically endorsed.`, **Weight Explorer** with 7 sliders. Changing one slider redistributes the remainder proportionally so the total is always exactly 100% (show "Total: 100%"), with a Reset button. Computation runs client-side via the shared `packages/scoring` for instant feedback.
- Center top: **Index hero number** (Barlow Condensed, very large), band pill (e.g. READY with glow), Confidence %, Evidence status.
- Right top: **"Why before what to do"** driver chips: Positive (top 3, green plus icon) and Negative (top 3, amber minus icon).
- **Component Breakdown** table: Component, Score bar (with numeric ghost value), Weight %, Contribution %. Each row expands to a **14-day sparkline**.
- Bottom: **Trace Provenance** button → `/system/validity/[athleteId]`, with the "M2 audit pathways" link text.

### 6.5 `/team-command/player/[id]` Player 360 and `/team-command/player/[id]/twin` (ref `5.jpg`)
Player 360 tabs: Overview, Twin, Games, Consent. Overview shows latest index, drivers, exceptions, 14-day trend, device and calibration status.
Twin page:
- **Twin header**: "Athlete A · DB · model applied SMX-SKILL™" with the weights used and a Back link.
- **BaselineBandChart**: 7 components, p10–p90 range band with p50 line and a dot for today's value; evidence tag `PROTOTYPE` or `DERIVED`.
- **ResponseCurveChart**: scatter plus fit line (e.g. "Accels vs Load"), dropdown to switch pairs, sample size `n=`; when n < 8 render an explicit **Insufficient sample** state and no fit line.
- **TrajectoryStrip**: 14 / 28 / 56-day toggle; **withheld days render as empty gaps** (no dots, no line); label "Past trend, NOT a forecast".
- **ScenarioComparePanel**: sliders (time-zone shift, heat index °C, AQI, altitude m, sleep h, practice load %), Base vs Simulated index cards (e.g. 81.4 READY vs 74.8 MONITOR), amber **Delta** card, per-component deltas list, banner "HYPOTHETICAL EXPLORATION: NOT A FORECAST", and the Trace Provenance link.

### 6.6 `/team-command/athlete/[id]/consent` Governance (ref `7.jpg`)
Tenant badge (org slug, plan, dataRegion, retention days, DB health). **Consent status** with three toggle buttons (Granted / Restricted / Revoked, high contrast, current state clearly marked). **Change form**: required "Change reason" textarea, "Authorize & Commit Change" button disabled until a reason is entered, creating an append-only `ConsentRecord` + `AuditRecord`. Callout: revoked consent withholds the score with `CONSENT_RESTRICTED` and research cohorts exclude restricted data. **Tamper-evident audit trail** list: Date, Event, Actor (role in brackets), Entity, Snapshot, ReasonCode, IP, Hash Chain "Verified e8f5…" with an info tooltip; each row has an expandable "Audit chain verification" line showing the append-linked hash. A **Verify chain** button recomputes hashes server-side (`GET /api/audit/verify`) and reports the first broken link, if any.
Hash rule: `hash_n = SHA-256(prevHash_n ‖ canonicalJSON(record_n without hash))`, genesis `prevHash = 64 zeros`.

### 6.7 `/team-command/settings/identity` (ref `8.jpg`)
Orange **Step-up authentication active** banner with expiry. **Identity Providers** card list: Okta OIDC (Active, JIT provisioning ON, issuer, client ID, secret shown only as "AES-256 encrypted" with a lock icon) and Entra ID SAML 2.0 (inactive, sign-on URL, certificate configured, "Copy SP Metadata XML"). **Group-to-role mapping** table (smx_executives → EXECUTIVE, smx_medical → MEDICAL, smx_coaches → COACH, smx_performance → PERFORMANCE; athletes fall back to ATHLETE). **Enterprise session policy**: max session lifetime, idle timeout, **Require MFA for roles** checkboxes. **SCIM 2.0**: base URL, masked token (`••••e4b2`), Generate / Rotate / Revoke (revoke is destructive, with confirm), Automatic deprovisioning toggle (soft-delete and revoke sessions immediately), allowed JIT email domains. Top-right data quality chip: "2 identity providers · 53 provisioned members · health: DB ok". Implement real SCIM endpoints (`/api/scim/v2/Users`, `/Groups`, `ServiceProviderConfig`) with bearer-token auth, hashed tokens at rest, and conformance tests for create, patch, deactivate.

### 6.8 `/internal/devices` Device Registry (ref `10.jpg`)
Internal-only (`INTERNAL ONLY` tag). Top chip: partner bridges, registered devices, secure samples, ingestion adapters (HTTP, FILE, SYNTHETIC) online, DB health. **Partner onboarding flow**: dropdown "Onboard device", **Register New Model** (6-step wizard with Zod-validated capability descriptor upload), list of registered models with partner. **Cross-tenant registered devices** table: ID, Tenant, Model (+ kind), Firmware (STABLE / PINNED / BETA), Last Ingest (or "Stale 2h ago"), Status (ACTIVE / OFFLINE / ERROR), Calibration (FRESH / AGING / STALE / FAILED / EXPIRED with colored dot and icon), Rejections (with reason, e.g. "calibration_expired"). Callout: "Hardware remains subordinate. Model registration validation (Zod schema validation) is mandatory. Device kind and metric schemas must align to the frozen Metric Catalog."

### 6.9 System-wide states (build once in `packages/ui`)
Loading (skeleton rows, never a full-page spinner), Empty (illustration + one primary action), Error (what happened, what was not changed, retry), **Withheld** (stamp + code + "Request retest"), Device offline (last valid value flagged stale), No access (403 page naming the role needed), Offline/stale-data banner. Apply to every screen above.

---

## 7. MARKETPLACE SCREENS (PRODUCT 2)

Brand lockup there reads "SPORTMETRYX · METABOLIC DATA MARKETPLACE". Same visual system. Fixed top-level nav: Home, Catalog, My Library, Reports, Wallet, Consent Center, Media, Advertise, Research, Developer Hub.

- **Athlete Home `/athlete/home`**: status and trust strip (last sync, device connection, battery, firmware, signal-quality score beside each number, source of each metric, mask wear time and valid-data time, plain-language definitions, decision-support note and sample-data label); latest session (date, start/end, venue, indoor/outdoor, GPS route with elevation, public weather and AQI, comparison with the athlete's own 30-day baseline, notes and tags); "Waiting for you" (buyer requests to approve/decline/counter, who has access now and when each license ends, profile completeness, alerts); money (earnings this month, pending payout, listing views and sales); controls (date range, metric/US units, **preview of public view**).
- **Load data (8 ways)**: device sync, wearable connections, file upload (CSV, workout files, PDF lab reports), lab/clinic import, team/coach bulk upload (consented athletes only), manual entry, partner API feed, photos/video. Every load runs format and unit checks, duplicate detection, adds a source tag and a quality score.
- **Selling `/listings/new`** wizard (Data set → Sell method → Price and identity → Buyer types → Review): six methods (fixed price, subscription feed, bundles, pooled anonymized sets, buyer requests, time-limited licenses). Athlete sets price, named or anonymized, allowed buyer types, **approves every sale**, can **withdraw access** anytime, sees every buyer and payment. Platform fee shown as "set by admin" until configured.
- **Sale flow** (state machine): LISTED → REQUESTED → (APPROVED | COUNTERED | DECLINED) → PAID (funds held) → DELIVERED → fee retained, athlete paid → AUDITED. Each transition writes an `AuditRecord`.
- **Catalog `/marketplace`**: search and filters (sport, position, age, level, environment, metric), cards with quality score and price, preview with sample rows and field list, license terms in plain words, saved searches with alerts. **Checkout `/checkout`**: cart, terms acceptance, Stripe Elements, receipt and invoice. **My Library `/library`**: acquired data sets, license end dates, HTML view, CSV, API, Renew.
- **Wallet `/wallet`**: balance, pending payout, lifetime earnings, monthly chart, payments, payout method (Stripe Connect onboarding), tax forms.
- **Consent Center `/consent-center`**: everyone with access, purpose, end date, **Withdraw**; field-by-field profile visibility (Public / Buyers only / Private); ads on profile on/off.
- **Reports `/reports`**: one builder, scope "All participants" or "One participant" (ranges and percentiles by sport/position/age/level, group vs group, trends, environment effects, correlation; or full profile, session detail, vs own baseline, rank within peer group, side by side with another licensed athlete). Saved templates, schedules, export PDF/CSV/HTML, **minimum group size n ≥ 10** (groups below it are hidden). Ship the 15 models behind a registry; implement the first 5 fully.
- **Every data set, profile and report opens as a web page** (responsive, sortable/zoomable tables, definitions and units inline, permission-aware links, embeddable, print-friendly).
- **Media `/media`**: stories, rankings and leaderboards, gallery, broadcast data licenses, press room, embeddable widgets (signed iframe + JS snippet). Named athletes appear only with consent.
- **Advertise `/advertise`**: campaign manager (budget, dates, creative upload, pay), placements, sponsorships, results (views, clicks, spend, audience by sport/level/region). Rules enforced in code: **targeting only by sport, level and region, never by an individual's health data**; athletes opt in to ads on their profile; every ad goes through review; revenue share configurable (draft was 50/50, unconfirmed).
- **Team Workspace `/team-workspace`**: roster data, consent state and device status per athlete, bulk upload that **rejects rows for athletes without consent** and reports counts.
- **Research `/research`**: study requests, ethics approval status, cohorts that automatically exclude restricted/revoked data, citations with dataset version IDs. **Developer Hub `/developer`**: API keys (live/test, hashed, rotate/revoke), usage chart, OpenAPI docs, 50-athlete synthetic test data.
- **Mobile athlete app**: ship a **responsive PWA** at `/m` with three screens (Home, Live session, Requests) designed for 390 px width and bottom tab bar. A native app is out of scope for now.

---

## 8. API SURFACE (REST, VERSIONED, ZOD-VALIDATED, OPENAPI GENERATED)

Auth: session cookie for the web app; bearer API keys for `/v1` public API. Rate limit per key and per IP. Idempotency keys on every POST that moves money or writes audit.

Core: `POST /api/ingest/http`, `POST /api/ingest/file`, `GET /api/roster`, `GET /api/athletes/:id/index`, `GET /api/athletes/:id/index/history?days=`, `POST /api/athletes/:id/consent`, `GET /api/exceptions`, `POST /api/interventions/:id/{approve,dismiss,snooze,restore}`, `POST /api/twin/simulate`, `GET /api/system/validity/:athleteId`, `GET /api/audit`, `GET /api/audit/verify`, `GET|POST /api/devices`, `POST /api/devices/models`, `/api/settings/identity/*`, `/api/scim/v2/*`.
Marketplace: `GET /api/marketplace/listings`, `POST /api/listings`, `POST /api/access-requests`, `POST /api/access-requests/:id/{approve,counter,decline}`, `POST /api/checkout`, `POST /api/webhooks/stripe`, `GET /api/library`, `POST /api/reports/run`, `GET /api/wallet`, `POST /api/payouts`, `POST /api/campaigns`, `GET /api/stories`, `GET /v1/datasets`, `GET /v1/datasets/:id/rows`, `GET /v1/licenses`.
Conventions: cursor pagination, RFC 7807 problem+json errors, ISO-8601 UTC timestamps, money in integer minor units.

---

## 9. INGESTION PIPELINE (`apps/worker`)

Ports-and-adapters: `IngestAdapter` interface with `HttpAdapter`, `FileAdapter` (CSV, XLSX, JSON, workout files, PDF lab text extraction), `SyntheticAdapter` (seeded generator), and stubs for partner bridges. Pipeline: receive → schema validate against **Metric Catalog** (unknown metric or wrong unit → `RejectedSample` with reason) → unit normalization → duplicate detection (hash of athlete+metric+ts+value) → attach source tag and signal quality → persist → enqueue scoring. Scoring job recomputes affected athletes, writes `IndexResult`, opens/closes `Exception` rows, creates `Intervention` suggestions. Jobs are idempotent and retried with backoff; dead-letter queue visible on an internal page.

---

## 10. SECURITY, PRIVACY AND COMPLIANCE REQUIREMENTS

- Postgres RLS by tenant plus an application-level tenant guard; automated test that proves tenant A cannot read tenant B.
- Secrets (IdP client secrets, SCIM/API tokens, Stripe keys) encrypted with envelope encryption or stored only as hashes; never logged; shown once at creation.
- CSRF protection, strict CSP, secure headers, input and output validation, SSRF-safe fetchers, upload type and size limits with malware-scan hook.
- Consent is enforced **in the data layer**, not only in UI: revoked or restricted athletes are excluded from scoring output, exports, cohorts, marketplace listings and reports.
- Data subject controls: export my data, delete my data (soft-delete then purge after retention), withdraw access.
- PII minimization in logs; audit log is append-only and tamper-evident (section 6.6).
- Document in `SECURITY.md` and `docs/privacy.md`. Add a note that health-related regulations (e.g. HIPAA/GDPR) need a legal review before real athlete data is used.

---

## 11. SEED DATA (`pnpm db:seed`)

Create a `demo` tenant with **50 synthetic athletes**, labeled `SYNTHETIC` everywhere, **56 days** of sessions with realistic noise, weekly cycles and a few travel/heat events. Guarantee these exact cases so the screenshots are reproducible:
- `EC-10 CONTROLLED_VALID`, DB, SKILL: index ≈ 81.4, READY, confidence 94%, no exceptions.
- `EC-11 MULTI_FAIL`, OL, TRENCH: WITHHELD / RETEST, 4 exceptions (CALIBRATION_STALE, SAMPLE_INTEGRITY_LOW and others), Critical.
- `EC-01 CALIBRATION_STALE`, QB: WITHHELD, High.
- `EC-12 CONSENT_RESTRICTED`, WR: WITHHELD, High.
- `Jordan, J.`, DL, TRENCH: index 58.2, MONITOR, confidence 88%, `LOAD_SPIKE` (acute:chronic > 1.5), Moderate; recovery score 42 (suppressed) producing a `RECOVERY_REVIEW` suggestion.
- `Smith, A.`: snoozed `RETEST_REQUESTED` (due Oct 11).
Roster totals should read **39 Ready, 10 Monitor, 4 Compromised, 3 Withheld**. Seed 5 devices (DEV-010 … DEV-014 as in the Device Registry screenshot), 3 partner models (SYNTHETIC, O2-MASK-V1/RespiroCorp, CHEST-STRAP-X/BioFit), an Okta provider, 4 group mappings, 15 marketplace data sets, 6 listings, sample buyers, a wallet history, one campaign and three stories. Seed users: one per role with documented demo credentials (demo tenant only).

---

## 12. PERFORMANCE AND QUALITY BARS

- Roster grid handles 2,000 athletes smoothly (virtualized); first load of `/team-command` under 2 s on seeded data; Explorer slider updates under 50 ms.
- Lighthouse: accessibility ≥ 95, best practices ≥ 95 on core screens.
- Responsive: fully usable at 1280 px+; tablet (≥ 768 px) usable; marketplace and mobile PWA usable at 390 px.
- `prefers-reduced-motion` respected (no pulse/glow animation).
- Internationalization-ready (`next-intl`), English first, RTL-safe layout (Arabic is a likely second language), currency and unit formatting through helpers, metric/US units toggle.

---

## 13. TESTING REQUIREMENTS (DEFINITION OF DONE FOR EACH PHASE)

Unit: weights sum rule, index math and the worked example, each validity gate and every combination, bands, confidence, driver ranking, twin sensitivity monotonicity, audit hash chain (tamper one row → verify fails), RBAC matrix, SCIM payloads, consent exclusion in every read path.
Integration (Testcontainers): ingestion → scoring → exception → intervention flow; RLS isolation; Stripe webhook idempotency; sale state machine.
E2E (Playwright), at minimum: (1) landing → role switch → roster, (2) filter to Withheld Only and open drawer, (3) approve an intervention and confirm no outbound side effect, (4) Explorer sliders always total 100% and Reset works, (5) Twin shows "not a forecast" and delta, (6) revoke consent → score becomes WITHHELD and athlete disappears from a cohort report, (7) SCIM create/deactivate, (8) athlete lists a data set → buyer checkout → athlete approval → buyer library access.
Visual regression snapshots for the 9 reference screens against the seeded data.

---

## 14. REPO LAYOUT AND DOCS

```
apps/web  apps/worker
packages/{db,scoring,ui,contracts,config}
docs/{architecture.md,scoring.md,privacy.md,runbook.md,decisions.md}
.github/workflows/ci.yml  docker-compose.yml  .env.example  SECURITY.md  README.md
```
README must let a new engineer run everything in under 10 minutes. `docs/decisions.md` records every assumption from section 17 with date and owner.

---

## 15. COPY AND TONE RULES

Plain, calm, operational language. Say what happened, what was not changed, and the next step. No hype inside the product (marketing hero is the only exception). Never use "predict", "diagnose", "treat" or "clinically proven" in product UI. Use "decision support", "review", "suggested", "withheld".

---

## 16. PHASES (STOP AND ASK AFTER EACH)

**Phase 1: Foundations.** Monorepo, tooling, Docker Compose, CI, design tokens, `packages/ui` (AppShell, Button, Card, Table, Tag/StatusTag, Slider, ConfidenceRing, Sparkline, WithheldStamp, states), Prisma schema + RLS + audit trigger, auth skeleton with demo users and Role Switcher, seed script (full seed data), README.
**Phase 2: Scoring engine + core Football screens.** `packages/scoring` with tests; Landing (6.1), Roster Mission Control (6.2), Interventions (6.3), Performance Index Explorer (6.4). Ingestion with SYNTHETIC adapter and worker.
**Phase 3: Twin, Player 360, Consent, Audit.** Screens 6.5 and 6.6, hash-chain verify, consent enforcement everywhere, provenance page.
**Phase 4: Enterprise.** Identity & SCIM (6.7), real OIDC/SAML login, MFA, step-up, session policy, Device Registry and model onboarding (6.8), full ingestion adapters.
**Phase 5: Marketplace core.** Athlete Home, data loading methods, listings wizard, catalog, checkout (Stripe test mode), library, wallet, consent center, sale state machine.
**Phase 6: Reports, Media, Ads, Research, Developer Hub, Team Workspace, mobile PWA.**
**Phase 7: Hardening.** Performance pass, accessibility audit, security review checklist, e2e suite complete, docs, demo script.

Start with **Phase 1 only**. Before writing code, output: (a) the repo tree you will create, (b) the Prisma schema summary, (c) the list of assumptions you are making. Then build.

---

## 17. OPEN DECISIONS AND DEFAULTS (USE DEFAULTS, RECORD IN `docs/decisions.md`)

| Decision | Default until the owner decides |
|---|---|
| Platform fee | 0%, configurable, shown as "set by admin" |
| Athlete share of ad revenue | 50% (draft), configurable |
| Band cutoffs | Ready ≥ 70, Monitor 40–69.9, Compromised < 40 |
| Minimum group size for reports | n ≥ 10 |
| Baseline window / min sessions | 28 days / 8 sessions |
| HTML view vs HTML export | Web page view for all; HTML export file added in Phase 6 |
| Launch languages / currencies | English, USD (i18n-ready, Arabic/RTL next) |
| First 5 report models | Percentiles by position, group vs group, season trend, environment effect (heat/AQI/altitude), full participant profile |
| Calibration staleness thresholds | stale > 24 h, high severity > 48 h |
| Retention | 730 days (as in the consent screen), configurable per tenant |

---

## 18. WHAT "DONE" LOOKS LIKE

The 9 reference screens render from seeded data with the same layout, numbers and states as the screenshots; every withheld state shows a stamp and gaps instead of numbers; Approve never acts; consent revocation withholds scores and removes data from cohorts, listings and exports; the audit chain verifies and detects tampering; Explorer weights always total 100%; the Twin always says "not a forecast"; an athlete can list, approve, and get paid in Stripe test mode; all tests pass in CI; and a new engineer can clone, run and demo the platform in 10 minutes.
