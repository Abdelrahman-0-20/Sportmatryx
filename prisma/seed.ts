 
/**
 * Sportmetryx Football — deterministic synthetic seed (PROTOTYPE DATA).
 *
 * Repeatability: reset with `pnpm db:setup` (init → migrate → seed) or
 * `pnpm db:reset && pnpm prisma migrate deploy && pnpm db:seed`.
 * Values are deterministic via mulberry32 PRNG; dates are anchored to the
 * seed run time so dashboards always show a fresh 14-day window.
 *
 * All records are SYNTHETIC and must never be presented as real measurements.
 * Demo credentials are development-only (documented in README).
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";
import { weightsForPosition } from "../src/lib/scoring/config";
import { computeScore, buildBaselines } from "../src/lib/scoring/engine";
import { mapValidity, persistScore } from "../src/lib/scoring/persist";
import type { MetricSnapshot, ScoringInput } from "../src/lib/scoring/types";
import type { MetricKey } from "../src/lib/scoring/config";

const prisma = new PrismaClient();

/** Deterministic observation id (40-hex) — avoids re-querying inserted rows. */
function obsIdFor(athleteId: string, type: string, timestamp: Date): string {
  return createHash("sha1").update(`${athleteId}|${type}|${timestamp.toISOString()}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const NOW = new Date();
const DAY_MS = 24 * 3600 * 1000;
function dayStart(offsetDays: number): Date {
  const d = new Date(NOW.getTime() - offsetDays * DAY_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function iso(d: Date): string {
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Athlete generation archetypes
// ---------------------------------------------------------------------------
interface AthleteSpec {
  externalId: string;
  first: string;
  last: string;
  position: "QB" | "SKILL" | "TRENCH" | "LB_TE" | "ST" | "OTHER";
  team: 0 | 1 | 2;
  archetype: "VALID_READY" | "VALID_MONITOR" | "LOAD_SPIKE" | "STALE_CAL" | "MULTI_FAIL" | "CONSENT_RESTRICTED" | "LOW_BASELINE" | "ORDINARY";
  rosterRole?: string;
}

const FIRST_NAMES = [
  "Marcus", "Tyrell", "Jordan", "Darnell", "Cole", "Amari", "Brock", "Xavier", "Trent", "Silas",
  "Jermaine", "Carter", "Deion", "Ezra", "Kelvin", "Malik", "Owen", "Paxton", "Reggie", "Shaun",
  "Terrence", "Vaughn", "Wallace", "Zion", "Anders", "Blaine", "Corbin", "Duke", "Emmitt", "Foster",
  "Grady", "Hassan", "Irvin", "Jamal", "Kurt", "Levi", "Micah", "Nash", "Orson", "Priest",
  "Quinton", "Rashad", "Sawyer", "Thaddeus", "Uriah", "Vance", "Wes", "Alex", "Bo", "Chris",
  "Dane", "Evan", "Frank", "Gus",
];
const LAST_NAMES = [
  "Whitmore", "Ellison", "Barrow", "Kadri", "Nakamura", "Osei", "Vasquez", "Draper", "Holt", "Mbeki",
  "Fontaine", "Grimaldi", "Shaw", "Petrov", "Reyes", "Sandoval", "Tucker", "Ulrich", "Vincent", "Woo",
  "Yates", "Zeller", "Adeyemi", "Brandt", "Cruz", "Delgado", "Eriksen", "Farrow", "Gibbs", "Harmon",
  "Ibarra", "Jansen", "Kowalski", "Lindqvist", "Moreau", "Novak", "Okafor", "Pietersen", "Quinn", "Rossi",
  "Silva", "Tanaka", "Ustinov", "Verhoeven", "Weber", "Xu", "Yilmaz", "Zapata", "Abernathy", "Byrne",
  "Castillo", "Doyle", "Egan", "Fitzgerald",
];

function athleteSpecs(): AthleteSpec[] {
  const specs: AthleteSpec[] = [
    { externalId: "EC-10", first: "Ethan", last: "Calhoun", position: "SKILL", team: 0, archetype: "VALID_READY", rosterRole: "Starter" },
    { externalId: "EC-01", first: "Enzo", last: "Calloway", position: "QB", team: 0, archetype: "STALE_CAL", rosterRole: "Starter" },
    { externalId: "EC-11", first: "Emmett", last: "Colter", position: "TRENCH", team: 0, archetype: "MULTI_FAIL", rosterRole: "Starter" },
    { externalId: "EC-12", first: "Elias", last: "Crane", position: "SKILL", team: 0, archetype: "CONSENT_RESTRICTED", rosterRole: "Starter" },
    { externalId: "EC-07", first: "Jordan", last: "Jennings", position: "TRENCH", team: 0, archetype: "LOAD_SPIKE", rosterRole: "Starter" },
    { externalId: "EC-15", first: "Arthur", last: "Smith", position: "LB_TE", team: 0, archetype: "VALID_MONITOR", rosterRole: "Starter" },
    { externalId: "EC-22", first: "Miles", last: "Okafor", position: "ST", team: 0, archetype: "LOW_BASELINE", rosterRole: "Specialist" },
    { externalId: "EC-23", first: "Theo", last: "Lindqvist", position: "ST", team: 0, archetype: "LOW_BASELINE", rosterRole: "Specialist" },
  ];
  const positions: AthleteSpec["position"][] = ["QB", "SKILL", "SKILL", "SKILL", "TRENCH", "TRENCH", "TRENCH", "TRENCH", "LB_TE", "LB_TE", "ST"];
  let fi = 0;
  let li = 0;
  let n = 0;
  for (let t = 0; t < 3; t++) {
    const perTeam = t === 0 ? 26 : t === 1 ? 14 : 10;
    while (specs.filter((s) => s.team === t).length < perTeam) {
      const position = positions[n % positions.length];
      specs.push({
        externalId: `EC-${(30 + n).toString().padStart(2, "0")}`,
        first: FIRST_NAMES[fi++ % FIRST_NAMES.length],
        last: LAST_NAMES[li++ % LAST_NAMES.length],
        position,
        team: t as 0 | 1 | 2,
        archetype: n % 9 === 0 ? "VALID_MONITOR" : "ORDINARY",
        rosterRole: n % 4 === 0 ? "Starter" : n % 4 === 1 ? "Rotation" : "Practice Squad",
      });
      n += 1;
    }
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Observation generation for one athlete/day
// ---------------------------------------------------------------------------
interface ObsDraft {
  id: string;
  athleteId: string;
  dataSourceId: string;
  deviceId: string | null;
  timestamp: Date;
  type: string;
  value: number;
  unit: string;
  isValid: boolean;
  metadata: Prisma.InputJsonValue;
}

function genDay(
  spec: AthleteSpec,
  athleteId: string,
  dsIds: Record<string, string>,
  deviceByArchetype: Record<string, string>,
  day: Date,
  rnd: () => number,
  opts: { game: boolean; practice: boolean; travel: boolean; heat: boolean; forceBad?: boolean; invalidHeavy?: boolean; bias?: number },
): ObsDraft[] {
  const out: ObsDraft[] = [];
  const push = (type: string, value: number, unit: string, deviceId: string | null, sigQ = 0.9, isValid = true, extra: Record<string, unknown> = {}) => {
    const timestamp = new Date(day.getTime() + (6 + rnd() * 8) * 3600 * 1000);
    out.push({
      id: obsIdFor(athleteId, type, timestamp),
      athleteId,
      dataSourceId: dsIds[type],
      deviceId,
      timestamp,
      type,
      value,
      unit,
      isValid,
      metadata: { source: "SYNTHETIC", signalQuality: sigQ, ...extra } as Prisma.InputJsonValue,
    });
  };

  const noisy = (base: number, amp: number) => base + (rnd() - 0.5) * amp;
  // Direction-aware bias: recent days trend up for READY athletes, down for
  // suppressed recovery. DEViation metrics stay near the athlete's own p50.
  const b = opts.bias ?? 0;
  const bad = opts.forceBad === true;
  const sig = bad ? 0.55 : 0.85 + rnd() * 0.15;
  const dev = deviceByArchetype[spec.archetype] ?? deviceByArchetype.ORDINARY;
  const invalid = opts.invalidHeavy ? rnd() < 0.25 : rnd() < 0.04;

  const wear = bad ? 12 : 30 + rnd() * 40;
  push("RESP_RATE", Math.max(6, noisy(16, 6)), "brpm", dev, sig, !invalid, { maskWearMinutes: Math.round(wear) });
  push("VENT_EFF", clamp(noisy(0.86 + b * 0.06, 0.12), 0.4, 0.99), "ratio", dev, sig, !invalid);
  push("SPO2", clamp(noisy(97 + b * 1.5, 3), 88, 100), "%", dev, sig, !invalid);
  push("VO2_PROXY", clamp(noisy(52 + b * 5, 10), 35, 70), "ml/kg/min", dev, sig, !invalid);
  push("HRV_MS", clamp(noisy(74 + b * 13, 26), 20, 160), "ms", dev, sig, !invalid);
  push("RHR", clamp(noisy(57 - b * 4, 8), 38, 90), "bpm", dev, sig, !invalid);
  push("SLEEP_H", clamp(noisy(7.6, 2.4), 4.5, 10.5), "h", null, sig, !invalid);
  push("JUMP_CM", clamp(noisy(56 + b * 5, 10), 30, 80), "cm", dev, sig, !invalid);
  push("ACCEL_N", Math.round(clamp(noisy(55, 30), 5, 140)), "count", dev, sig, !invalid);

  if (opts.game || opts.practice) {
    const load = opts.game ? noisy(840, 220) : noisy(560, 200);
    push("LOAD_AU", Math.round(clamp(load, 120, 1200)), "au", dev, sig, !invalid);
    push("ACWR", clamp(noisy(spec.archetype === "LOAD_SPIKE" && opts.practice ? 1.72 : 1.12, 0.4), 0.5, 2.2), "ratio", dev, sig, !invalid);
  } else {
    push("ACWR", clamp(noisy(0.95, 0.3), 0.4, 1.4), "ratio", dev, sig, !invalid);
  }

  // Environment (synthetic sourced context)
  const heat = opts.heat ? 29 + rnd() * 8 : 17 + rnd() * 9;
  const aqi = opts.heat ? 55 + rnd() * 60 : 18 + rnd() * 45;
  const alt = 120 + rnd() * 300;
  const tz = opts.travel ? 5 + rnd() * 2 : 0;
  push("HEAT_C", Number(heat.toFixed(1)), "°C", null, 1, true);
  push("AQI", Math.round(aqi), "index", null, 1, true);
  push("ALT_M", Math.round(alt), "m", null, 1, true);
  push("TZ_SHIFT_H", Number(tz.toFixed(1)), "h", null, 1, true);

  return out;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
type Phase1Refs = {
  users: Record<string, string>;
  teams: { id: string; name: string }[];
  devices: Record<string, string>;
  ds: Record<string, string>;
  deviceByArchetype: Record<string, string>;
  model: { id: string };
  modelVersion: { id: string };
  createdAthletes: { id: string; spec: AthleteSpec }[];
};

const SEED_PHASE = (process.env.SEED_PHASE ?? "all") as "1" | "2" | "all";

const USERS_SPEC: { email: string; name: string; role: "ADMIN" | "PERFORMANCE" | "MEDICAL" | "COACH" | "EXECUTIVE" | "ATHLETE" }[] = [
  { email: "admin@demo.sportmetryx.dev", name: "Demo Administrator (DEV ONLY)", role: "ADMIN" },
  { email: "performance@demo.sportmetryx.dev", name: "Demo Performance Staff (DEV ONLY)", role: "PERFORMANCE" },
  { email: "medical@demo.sportmetryx.dev", name: "Demo Medical Staff (DEV ONLY)", role: "MEDICAL" },
  { email: "coach@demo.sportmetryx.dev", name: "Demo Coach / Football Ops (DEV ONLY)", role: "COACH" },
  { email: "executive@demo.sportmetryx.dev", name: "Demo Executive (DEV ONLY)", role: "EXECUTIVE" },
  { email: "athlete@demo.sportmetryx.dev", name: "Demo Athlete (DEV ONLY)", role: "ATHLETE" },
];

const HISTORY_DAYS = 28;
const SCORE_DAYS = 14;
const seedSummary = { teams: 0, athletes: 0, scores: 0, withheld: 0 };

async function main() {
  console.log(`Seeding Sportmetryx Football demo (SEED_PHASE=${SEED_PHASE})…`);
  let phase1Capture: Phase1Refs | null = null;
  if (SEED_PHASE !== "2") {
  // ---- 1. Wipe (repeatable reset) ----
  await prisma.interventionReview.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.validityCheck.deleteMany();
  await prisma.scoreDriver.deleteMany();
  await prisma.scoreComponent.deleteMany();
  await prisma.performanceScore.deleteMany();
  await prisma.baselineObservation.deleteMany();
  await prisma.athleteBaseline.deleteMany();
  await prisma.footballContext.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.calibrationRecord.deleteMany();
  await prisma.device.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.positionConfiguration.deleteMany();
  await prisma.modelConfigurationVersion.deleteMany();
  await prisma.performanceModel.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // ---- 2. Users (development-only demo accounts) ----
  const demoPassword = "Demo-SMX-2024!";
  const hashed = await hashPassword(demoPassword);
  const usersSpec = USERS_SPEC;
  const users: Record<string, string> = {};
  for (const u of usersSpec) {
    const created = await prisma.user.create({
      data: { email: u.email, name: u.name, role: u.role, hashedPassword: hashed },
      select: { id: true },
    });
    users[u.role] = created.id;
  }

  // ---- 3. Teams ----
  const teams = await Promise.all([
    prisma.team.create({ data: { name: "Ironmark Stallions", description: "Primary demo franchise (synthetic roster)." } }),
    prisma.team.create({ data: { name: "Redgate Falcons", description: "Satellite demo club (synthetic roster)." } }),
    prisma.team.create({ data: { name: "Caldera Miners", description: "Satellite demo club (synthetic roster)." } }),
  ]);
  for (const [role, userId] of Object.entries(users)) {
    await prisma.teamMembership.create({
      data: { userId, teamId: teams[0].id, role: role as "ADMIN" | "PERFORMANCE" | "MEDICAL" | "COACH" | "EXECUTIVE" | "ATHLETE" },
    });
  }

  // ---- 4. Position configurations + performance model versions ----
  const positionDescriptions: Record<string, string> = {
    QB: "SMX-QB — quarterback workload and recovery emphasis.",
    SKILL: "SMX-SKILL — wide receivers, running backs, defensive backs.",
    TRENCH: "SMX-TRENCH — offensive and defensive line.",
    LB_TE: "SMX-LB/TE — linebacker, tight end and hybrid roles.",
    ST: "SMX-ST — kicking, punting and return units.",
    OTHER: "Unassigned hybrid roles.",
  };
  for (const p of ["QB", "SKILL", "TRENCH", "LB_TE", "ST", "OTHER"] as const) {
    await prisma.positionConfiguration.create({
      data: { positionType: p, description: positionDescriptions[p] },
    });
  }

  const model = await prisma.performanceModel.create({
    data: {
      name: "SMX Performance Index",
      description: "Composite readiness index (0–100). PROTOTYPE — decision support only.",
    },
  });
  const modelVersion = await prisma.modelConfigurationVersion.create({
    data: {
      performanceModelId: model.id,
      versionNumber: 1,
      isActive: true,
      weights: weightsForPosition("DEFAULT") as unknown as Prisma.InputJsonValue,
      normalizationRules: {
        method: "ATHLETE_OWN_BASELINE_P10_P90",
        deviation: "Closeness to athlete's own p50",
        renormalization: "EXPLICIT when components missing; result marked LIMITED",
      } as unknown as Prisma.InputJsonValue,
      validityRules: {
        calibrationStaleHours: 24,
        calibrationCriticalHours: 48,
        minValidSampleRatio: 0.8,
        minSignalQuality: 0.7,
        minMaskWearMinutes: 20,
        baselineWindowDays: 28,
        baselineMinObservations: 8,
        bands: { READY: 70, MONITOR: 40 },
        acwrSpikeThreshold: 1.5,
      } as unknown as Prisma.InputJsonValue,
      createdBy: users.ADMIN,
    },
  });

  // ---- 5. Devices + calibration ----
  const hAgo = (h: number) => new Date(NOW.getTime() - h * 3600000);
  const deviceDefs = [
    { serial: "DEV-010", model: "O2-MASK-V1", manufacturer: "RespiroCorp", type: "Respiratory Mask", calH: 2, calStatus: "OK" },
    { serial: "DEV-011", model: "CHEST-STRAP-X", manufacturer: "BioFit", type: "Chest Strap", calH: 30, calStatus: "OK" },
    { serial: "DEV-012", model: "O2-MASK-V1", manufacturer: "RespiroCorp", type: "Respiratory Mask", calH: 60, calStatus: "OK" },
    { serial: "DEV-013", model: "O2-MASK-V1", manufacturer: "RespiroCorp", type: "Respiratory Mask", calH: 72, calStatus: "Expired" },
    { serial: "DEV-014", model: "GPS-POD-G3", manufacturer: "FieldSense", type: "GPS Unit", calH: 4, calStatus: "OK" },
    { serial: "DEV-015", model: "ENV-STATION-1", manufacturer: "Aeris Labs", type: "Environment Station", calH: 8, calStatus: "OK" },
  ];
  const devices: Record<string, string> = {};
  for (const d of deviceDefs) {
    const created = await prisma.device.create({
      data: {
        serialNumber: d.serial,
        model: d.model,
        manufacturer: d.manufacturer,
        type: d.type,
        description: `Synthetic demo ${d.type.toLowerCase()} (${d.serial}).`,
        isActive: true,
      },
      select: { id: true },
    });
    devices[d.serial] = created.id;
    await prisma.calibrationRecord.create({
      data: {
        deviceId: created.id,
        calibrationDate: hAgo(d.calH),
        nextCalibrationDate: new Date(NOW.getTime() + 14 * DAY_MS),
        status: d.calStatus,
        performedBy: users.PERFORMANCE,
        notes: d.calStatus === "OK" ? "Routine calibration (synthetic)." : "Synthetic demo device with overdue calibration.",
      },
    });
  }
  const deviceByArchetype: Record<string, string> = {
    STALE_CAL: devices["DEV-012"],
    MULTI_FAIL: devices["DEV-013"],
    ORDINARY: devices["DEV-010"],
    VALID_READY: devices["DEV-010"],
    VALID_MONITOR: devices["DEV-011"],
    LOAD_SPIKE: devices["DEV-011"],
    CONSENT_RESTRICTED: devices["DEV-010"],
    LOW_BASELINE: devices["DEV-014"],
  };

  // ---- 6. Data sources ----
  const srcDefs = [
    { name: "Synthetic Generator", type: "SYNTHETIC" },
    { name: "Manual Entry", type: "MANUAL" },
    { name: "CSV Import", type: "FILE_UPLOAD" },
    { name: "Device Stream", type: "DEVICE_INTEGRATION" },
    { name: "Environment Feed", type: "SYNTHETIC" },
  ];
  const ds: Record<string, string> = {};
  for (const s of srcDefs) {
    const created = await prisma.dataSource.create({
      data: { name: s.name, type: s.type, description: "Synthetic demo source." },
      select: { id: true },
    });
    ds[s.name] = created.id;
  }
  const dsIds: Record<string, string> = {
    RESP_RATE: ds["Device Stream"],
    VENT_EFF: ds["Device Stream"],
    SPO2: ds["Device Stream"],
    VO2_PROXY: ds["Device Stream"],
    HRV_MS: ds["Device Stream"],
    RHR: ds["Device Stream"],
    SLEEP_H: ds["Device Stream"],
    LOAD_AU: ds["Synthetic Generator"],
    ACWR: ds["Synthetic Generator"],
    JUMP_CM: ds["Synthetic Generator"],
    ACCEL_N: ds["Synthetic Generator"],
    HEAT_C: ds["Environment Feed"],
    AQI: ds["Environment Feed"],
    ALT_M: ds["Environment Feed"],
    TZ_SHIFT_H: ds["Environment Feed"],
  };

  // ---- 7. Athletes, consent, history, baselines, scores ----
  const specs = athleteSpecs();
  const createdAthletes: { id: string; spec: AthleteSpec }[] = [];
  for (const spec of specs) {
    const athlete = await prisma.athlete.create({
      data: {
        externalId: spec.externalId,
        firstName: spec.first,
        lastName: spec.last,
        teamId: teams[spec.team].id,
        position: spec.position,
        rosterRole: spec.rosterRole ?? "Rotation",
        isActive: true,
        dateOfBirth: new Date(1996 + (seedFromString(spec.externalId) % 8), (seedFromString(spec.first) % 12), 1 + (seedFromString(spec.last) % 27)),
      },
      select: { id: true },
    });
    createdAthletes.push({ id: athlete.id, spec });

    const consentStatus = (spec.archetype === "CONSENT_RESTRICTED" ? "RESTRICTED" : "GRANTED") as "RESTRICTED" | "GRANTED";
    await prisma.consentRecord.create({
      data: {
        athleteId: athlete.id,
        consentType: "Data Sharing",
        status: consentStatus,
        grantedAt: hAgo(40 * 24),
        reason:
          consentStatus === "RESTRICTED"
            ? "Restricted by athlete request pending consent re-evaluation (synthetic)."
            : "Baseline demo consent for synthetic data.",
        grantedBy: users.ADMIN,
      },
    });
  }

  // Deterministic replay of the full observation generation (pure CPU).
  const { observationRows, perAthleteDayObs, latestDayIds } = replayGeneration(
    createdAthletes,
    dsIds,
    deviceByArchetype,
  );

  // Bulk insert observations (chunks to stay within parameter limits).
  const chunkSize = 4000;
  for (let i = 0; i < observationRows.length; i += chunkSize) {
    await prisma.observation.createMany({ data: observationRows.slice(i, i + chunkSize) });
  }
  console.log(`Inserted ${observationRows.length} synthetic observations.`);

  }

  // ---- Phase 2: baselines, scores, sessions, interventions, reports, audit ----
  if (SEED_PHASE !== "1") {
    await seedPhase2(SEED_PHASE === "2" ? undefined : phase1Capture ?? undefined);
  }

  console.log("Seed complete.");
  console.log(`Teams: ${seedSummary.teams} · Athletes: ${seedSummary.athletes} · Scores: ${seedSummary.scores} (withheld ${seedSummary.withheld})`);
  console.log("DEMO CREDENTIALS (development only — all accounts use this password):");
  console.log("  Password: Demo-SMX-2024!");
  for (const u of USERS_SPEC) console.log(`  ${u.role.padEnd(11)} ${u.email}`);
  await prisma.$disconnect();
}

/**
 * Deterministic replay of the synthetic observation generation (pure CPU).
 * Used by phase 1 (to insert rows) and phase 2 (to rebuild scoring inputs
 * without re-querying the database).
 */
function replayGeneration(
  createdAthletes: { id: string; spec: AthleteSpec }[],
  dsIds: Record<string, string>,
  deviceByArchetype: Record<string, string>,
): {
  observationRows: ObsDraft[];
  perAthleteDayObs: Map<string, { daysAgo: number; obs: ObsDraft[] }[]>;
  latestDayIds: Record<string, Partial<Record<MetricKey, string>>>;
} {
  const observationRows: ObsDraft[] = [];
  const latestDayIds: Record<string, Partial<Record<MetricKey, string>>> = {};
  // Per athlete: day entries ordered oldest → newest with their offset.
  const perAthleteDayObs: Map<string, { daysAgo: number; obs: ObsDraft[] }[]> = new Map();

  // Low-baseline athletes get only 5 days of observations (INSUFFICIENT_BASELINE).

  for (const { id: athleteId, spec } of createdAthletes) {
    const rnd = mulberry32(seedFromString(spec.externalId));
    const days: { daysAgo: number; obs: ObsDraft[] }[] = [];
    const totalDays = spec.archetype === "LOW_BASELINE" ? 5 : HISTORY_DAYS;
    // Bias profile: the first half of the window is neutral history that
    // establishes the baseline; the scoring window ramps per archetype so
    // READY athletes trend up, suppressed-recovery athletes trend down.
    const biasFor = (d: number): number => {
      if (d >= 14 || spec.archetype === "LOW_BASELINE") return 0;
      const ramp = 1 - d / 14; // 1 today → ~0 fourteen days ago
      switch (spec.archetype) {
        case "VALID_READY": return 0.95 * ramp;
        case "ORDINARY": return 0.55 * ramp;
        case "VALID_MONITOR": return -0.15 * ramp;
        case "LOAD_SPIKE": return -0.18 * ramp;
        default: return 0;
      }
    };
    for (let d = totalDays - 1; d >= 0; d--) {
      const day = dayStart(d);
      const dow = day.getUTCDay();
      const scoringWindow = d < 14 && spec.archetype !== "LOW_BASELINE";
      const game = dow === 0 && d > 1;
      // Controlled-valid and load-spike demo athletes train daily in the
      // scoring window so their latest day carries a full workload capture.
      const practice = scoringWindow && (spec.archetype === "VALID_READY" || spec.archetype === "LOAD_SPIKE")
        ? true
        : !game && dow !== 2 && dow !== 4 && rnd() > 0.25;
      const travel = d % 9 === 0 && spec.archetype !== "LOW_BASELINE";
      const heat = d % 11 === 0;
      const forceBad = spec.archetype === "MULTI_FAIL" && d <= 2;
      const invalidHeavy = spec.archetype === "MULTI_FAIL" && d === 1;
      const obs = genDay(spec, athleteId, dsIds, deviceByArchetype, day, rnd, { game, practice, travel, heat, forceBad, invalidHeavy, bias: biasFor(d) });
      days.push({ daysAgo: d, obs });
      observationRows.push(...obs);
      if (d === 0) {
        latestDayIds[athleteId] = Object.fromEntries(obs.map((o) => [o.type, o.id]));
      }
    }
    perAthleteDayObs.set(athleteId, days);
  }


  return { observationRows, perAthleteDayObs, latestDayIds };
}


/**
 * Phase 2 — baselines, scores, sessions, interventions, reports, audit.
 * Runs standalone (re-queries reference entities) or with phase-1 refs
 * passed in. All inserts are batched so the phase fits in short-lived
 * CI/deploy windows even against a remote database.
 */
async function seedPhase2(refs?: Phase1Refs): Promise<void> {
  // ---- Resolve reference entities (re-query when running standalone) ----
  let users: Record<string, string>;
  let teams: { id: string; name: string }[];
  let devices: Record<string, string>;
  let ds: Record<string, string>;
  let deviceByArchetype: Record<string, string>;
  let model: { id: string };
  let modelVersion: { id: string };
  let createdAthletes: { id: string; spec: AthleteSpec }[];

  if (refs) {
    ({ users, teams, devices, ds, deviceByArchetype, model, modelVersion, createdAthletes } = refs);
  } else {
    const userRows = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    users = {};
    for (const u of userRows) {
      const spec = USERS_SPEC.find((x) => x.email === u.email);
      if (spec) users[spec.role] = u.id;
    }
    const order = ["Ironmark Stallions", "Redgate Falcons", "Caldera Miners"];
    const teamRows = await prisma.team.findMany({ where: { name: { in: order } }, select: { id: true, name: true } });
    teams = order.map((n) => teamRows.find((t) => t.name === n)!);
    const deviceRows = await prisma.device.findMany({ select: { id: true, serialNumber: true } });
    devices = Object.fromEntries(deviceRows.map((d) => [d.serialNumber, d.id]));
    const srcRows = await prisma.dataSource.findMany({ select: { id: true, name: true } });
    ds = Object.fromEntries(srcRows.map((x) => [x.name, x.id]));
    deviceByArchetype = {
      STALE_CAL: devices["DEV-012"],
      MULTI_FAIL: devices["DEV-013"],
      ORDINARY: devices["DEV-010"],
      VALID_READY: devices["DEV-010"],
      VALID_MONITOR: devices["DEV-011"],
      LOAD_SPIKE: devices["DEV-011"],
      CONSENT_RESTRICTED: devices["DEV-010"],
      LOW_BASELINE: devices["DEV-014"],
    };
    const m = await prisma.performanceModel.findUnique({ where: { name: "SMX Performance Index" }, select: { id: true } });
    if (!m) throw new Error("Phase 2: performance model missing — run phase 1 first.");
    model = m;
    const v = await prisma.modelConfigurationVersion.findFirst({
      where: { performanceModelId: m.id, versionNumber: 1 },
      select: { id: true },
    });
    if (!v) throw new Error("Phase 2: model configuration version missing — run phase 1 first.");
    modelVersion = v;
    const athleteRows = await prisma.athlete.findMany({
      select: { id: true, externalId: true, position: true, firstName: true, lastName: true, teamId: true, rosterRole: true },
    });
    const byExternal = new Map(athleteRows.map((a) => [a.externalId ?? "", a]));
    createdAthletes = athleteSpecs()
      .map((spec) => {
        const row = byExternal.get(spec.externalId);
        return row ? { id: row.id, spec } : null;
      })
      .filter((x): x is { id: string; spec: AthleteSpec } => x !== null);
  }
  const athleteByExternal = new Map(createdAthletes.map((a) => [a.spec.externalId, a.id]));

  // ---- Deterministic replay of observation generation (pure CPU) ----
  const { perAthleteDayObs, latestDayIds } = replayGeneration(createdAthletes, ds, deviceByArchetype);

  // ---- Baselines (batched) ----
  const baselineIdFor: Record<string, string> = {};
  const baselineRows: {
    athleteId: string;
    baselineType: string;
    startDate: Date;
    endDate: Date;
    status: string;
    version: number;
    notes: string;
    obs: { observationType: string; value: number; unit: string; metadata: Prisma.InputJsonValue }[];
  }[] = [];
  for (const { id: athleteId, spec } of createdAthleteSpecs(createdAthletes)) {
    const days = perAthleteDayObs.get(athleteId) ?? [];
    const history: MetricSnapshot[] = [];
    for (const entry of days.slice(0, -1)) {
      for (const o of entry.obs) {
        history.push({
          metric: o.type as MetricKey,
          value: o.value,
          unit: o.unit,
          timestamp: iso(o.timestamp),
          signalQuality: Number((o.metadata as Record<string, unknown>).signalQuality ?? 0.9),
          isValid: o.isValid,
          source: "SYNTHETIC",
        });
      }
    }
    const baselineMetrics: MetricKey[] = ["RESP_RATE", "VENT_EFF", "SPO2", "VO2_PROXY", "HRV_MS", "RHR", "SLEEP_H", "LOAD_AU", "JUMP_CM"];
    const bl = buildBaselines(history, baselineMetrics, 28, 8, NOW);
    const rows = bl
      .filter((b) => !Number.isNaN(b.p10))
      .map((b) => ({
        observationType: b.metric,
        value: b.p50,
        unit: "",
        metadata: { p10: b.p10, p50: b.p50, p90: b.p90, n: b.n, windowDays: b.windowDays } as unknown as Prisma.InputJsonValue,
      }));
    const status = rows.length === 0 || bl.every((b) => b.n < 8) ? "INSUFFICIENT_DATA" : "ACTIVE";
    baselineRows.push({
      athleteId,
      baselineType: "PERFORMANCE",
      startDate: dayStart(28),
      endDate: NOW,
      status,
      version: 1,
      notes: `Rolling 28-day synthetic baseline for ${spec.externalId}.`,
      obs: rows,
    });
  }
  await prisma.athleteBaseline.createManyAndReturn({
    data: baselineRows.map(({ obs, ...rest }) => ({
      athleteId: rest.athleteId,
      baselineType: rest.baselineType,
      startDate: rest.startDate,
      endDate: rest.endDate,
      status: rest.status as "ACTIVE" | "ARCHIVED" | "PENDING" | "INSUFFICIENT_DATA",
      version: rest.version,
      notes: rest.notes,
    })),
  });
  const blRows = await prisma.athleteBaseline.findMany({
    where: { athleteId: { in: baselineRows.map((b) => b.athleteId) } },
    select: { id: true, athleteId: true },
  });
  for (const r of blRows) baselineIdFor[r.athleteId] = r.id;
  const blObsRows = baselineRows.flatMap((b) =>
    b.obs.map((o) => ({ ...o, athleteBaselineId: baselineIdFor[b.athleteId] })),
  );
  for (let i = 0; i < blObsRows.length; i += 1000) {
    await prisma.baselineObservation.createMany({ data: blObsRows.slice(i, i + 1000) });
  }
  console.log(`Created ${baselineRows.length} athlete baselines.`);

  // ---- Scores: run the REAL engine over the last 14 days (batched) ----
  const scoreRows: Prisma.PerformanceScoreUncheckedCreateInput[] = [];
  const compRows: Prisma.ScoreComponentUncheckedCreateInput[] = [];
  const driverRows: Prisma.ScoreDriverUncheckedCreateInput[] = [];
  const checkRows: Prisma.ValidityCheckUncheckedCreateInput[] = [];
  let scoreCount = 0;
  let withheldCount = 0;

  const scoreOneAthlete = ({ id: athleteId, spec }: { id: string; spec: AthleteSpec }) => {
    const days = perAthleteDayObs.get(athleteId) ?? [];
    const scoringDays = days.slice(-SCORE_DAYS);
    const consent: ScoringInput["consent"] = spec.archetype === "CONSENT_RESTRICTED" ? "RESTRICTED" : "GRANTED";
    const calH = spec.archetype === "STALE_CAL" ? 60 : spec.archetype === "MULTI_FAIL" ? 72 : 8;
    const calStatus = spec.archetype === "MULTI_FAIL" ? "Expired" : "OK";
    const deviceSerial = calDev(spec);
    const deviceKey = deviceByArchetype[spec.archetype] ?? deviceByArchetype.ORDINARY;
    const baselineRowsForAthlete = baselineRows.find((b) => b.athleteId === athleteId);
    const baselinesForEngine = (baselineRowsForAthlete?.obs ?? []).map((o) => {
      const meta = o.metadata as { p10?: number; p50?: number; p90?: number; n?: number; windowDays?: number };
      return {
        metric: o.observationType as MetricKey,
        p10: meta.p10 ?? NaN,
        p50: meta.p50 ?? NaN,
        p90: meta.p90 ?? NaN,
        n: meta.n ?? 0,
        windowDays: meta.windowDays ?? 28,
      };
    });

    let prior: Record<string, number> | null = null;
    let local = 0;
    let localWithheld = 0;
    for (const entry of scoringDays) {
      const dayObs = entry.obs;
      if (dayObs.length === 0) continue;
      const dayDate = dayStart(entry.daysAgo);
      const evaluationNow = dayStart(entry.daysAgo - 1);
      const calibratedAt = new Date(dayDate.getTime() + 14 * 3600 * 1000 - calH * 3600 * 1000);
      const cal = {
        deviceId: deviceKey,
        deviceLabel: deviceLabelFor(deviceSerial),
        calibratedAt: iso(calibratedAt),
        status: calStatus,
      };
      const observations: MetricSnapshot[] = dayObs.map((o) => ({
        metric: o.type as MetricKey,
        value: o.value,
        unit: o.unit,
        timestamp: iso(o.timestamp),
        signalQuality: Number((o.metadata as Record<string, unknown>).signalQuality ?? 0.9),
        isValid: o.isValid,
        source: "SYNTHETIC",
        maskWearMinutes: (o.metadata as Record<string, unknown>).maskWearMinutes as number | undefined,
      }));
      const weights = weightsForPosition(spec.position);
      const input: ScoringInput = {
        athleteId,
        position: spec.position,
        scoringDate: iso(dayDate),
        weights: weights as unknown as Record<string, number>,
        observations,
        baselines: baselinesForEngine,
        consent,
        calibration: cal,
        now: iso(evaluationNow),
        priorContributions: prior,
      };
      const result = computeScore(input);
      const scoreKey = `${athleteId}|${iso(dayDate)}`;
      scoreRows.push({
        athleteId,
        performanceModelId: model.id,
        modelConfigurationVersionId: modelVersion.id,
        athleteBaselineId: baselineIdFor[athleteId] ?? null,
        timestamp: dayDate,
        score: result.score,
        scoreBand: result.band,
        confidence: result.confidence === null ? null : result.confidence / 100,
        validityStatus: mapValidity(result.validity),
        validityReason: result.withheldCode,
        explanation: result.explanation,
      });
      for (const c of result.components) {
        const firstMetric = c.metricDetails[0]?.metric as string | undefined;
        compRows.push({
          performanceScoreId: scoreKey,
          componentName: c.component,
          normalizedValue: c.score ?? 0,
          originalValue: c.metricDetails[0]?.value ?? null,
          originalUnit: c.metricDetails[0]?.unit ?? null,
          weightApplied: c.weight,
          contributionToScore: c.contribution ?? 0,
          validityStatus: c.score === null ? "INSUFFICIENT_DATA" : result.validity === "LIMITED" ? "LIMITED" : "VALID",
          validityReason: c.reason,
          observationId:
            (entry.daysAgo === 0 && firstMetric ? latestDayIds[athleteId]?.[firstMetric as MetricKey] : undefined) ?? null,
        });
      }
      for (const d of result.drivers) {
        driverRows.push({ performanceScoreId: scoreKey, driverType: d.type, description: d.text, strength: d.strength });
      }
      for (const c of result.checks) {
        checkRows.push({
          performanceScoreId: scoreKey,
          checkName: c.check,
          status: c.status,
          reason: c.reason,
          details: { severity: c.severity } as unknown as Prisma.InputJsonValue,
        });
      }
      prior = Object.fromEntries(
        result.components.filter((c) => c.contribution !== null).map((c) => [c.component, c.contribution as number]),
      );
      local += 1;
      if (result.score === null) localWithheld += 1;
    }
    return { local, localWithheld };
  };

  const results = createdAthleteSpecs(createdAthletes).map(scoreOneAthlete);
  scoreCount = results.reduce((acc, r) => acc + r.local, 0);
  withheldCount = results.reduce((acc, r) => acc + r.localWithheld, 0);

  const insertedScores = await prisma.performanceScore.createManyAndReturn({ data: scoreRows });
  const scoreIdByKey = new Map<string, string>();
  for (const row of insertedScores) {
    scoreIdByKey.set(`${row.athleteId}|${new Date(row.timestamp).toISOString()}`, row.id);
  }
  const remap = <T extends { performanceScoreId: string }>(rows: T[]) =>
    rows.map((r) => ({ ...r, performanceScoreId: scoreIdByKey.get(r.performanceScoreId)! }));
  const compResolved = remap(compRows);
  const driverResolved = remap(driverRows);
  const checkResolved = remap(checkRows);
  for (let i = 0; i < compResolved.length; i += 1000) {
    await prisma.scoreComponent.createMany({ data: compResolved.slice(i, i + 1000) });
  }
  for (let i = 0; i < driverResolved.length; i += 1000) {
    await prisma.scoreDriver.createMany({ data: driverResolved.slice(i, i + 1000) });
  }
  for (let i = 0; i < checkResolved.length; i += 1000) {
    await prisma.validityCheck.createMany({ data: checkResolved.slice(i, i + 1000) });
  }
  console.log(`Created ${scoreCount} performance scores (${withheldCount} withheld by validity gates).`);

  // ---- Training sessions + football contexts (batched) ----
  const sessionRows: Prisma.TrainingSessionUncheckedCreateInput[] = [];
  const ctxMeta: { athleteId: string; d: number; spec: AthleteSpec; rnd: () => number; type: string }[] = [];
  for (const { id: athleteId, spec } of createdAthleteSpecs(createdAthletes)) {
    const rnd = mulberry32(seedFromString(spec.externalId + ":sessions"));
    for (let d = 0; d < 14; d += 2) {
      const day = dayStart(d);
      const dow = day.getUTCDay();
      const type = (dow === 0 ? "GAME" : dow === 2 ? "RECOVERY" : d % 9 === 0 ? "TRAVEL" : "PRACTICE") as
        | "PRACTICE" | "GAME" | "RECOVERY" | "TESTING" | "TRAVEL";
      sessionRows.push({
        athleteId,
        sessionType: type,
        date: day,
        durationMinutes: type === "GAME" ? 180 : type === "RECOVERY" ? 45 : 90 + Math.round(rnd() * 30),
        intensity: type === "GAME" ? "High" : rnd() > 0.5 ? "Medium" : "High",
        description: `Synthetic ${type.toLowerCase()} session.`,
      });
      ctxMeta.push({ athleteId, d, spec, rnd, type });
    }
  }
  const insertedSessions = await prisma.trainingSession.createManyAndReturn({ data: sessionRows });
  const sessionIdByKey = new Map<string, string>();
  for (const row of insertedSessions) {
    sessionIdByKey.set(`${row.athleteId}|${new Date(row.date).toISOString()}`, row.id);
  }
  const contextRows: Prisma.FootballContextUncheckedCreateInput[] = ctxMeta.map(({ athleteId, d, spec, rnd, type }) => ({
    athleteId,
    trainingSessionId: sessionIdByKey.get(`${athleteId}|${dayStart(d).toISOString()}`)!,
    opponent: type === "GAME" ? ["Ironmark Rival A", "Ironmark Rival B", "Cross-town Club"][(d / 2) % 3] : null,
    quarter: type === "GAME" ? 1 + Math.round(rnd() * 3) : null,
    drive: type === "GAME" ? 1 + Math.round(rnd() * 10) : null,
    drill: type === "PRACTICE" ? ["Team Install", "Red Zone", "Special Teams", "Conditioning"][d % 4] : null,
    repetition: type === "PRACTICE" ? 1 + Math.round(rnd() * 12) : null,
    venue: teams[spec.team].name + " Field",
    surface: rnd() > 0.3 ? "Grass" : "Turf",
    isIndoor: rnd() > 0.7,
    temperature: 16 + Math.round(rnd() * 18),
    humidity: 30 + Math.round(rnd() * 50),
    airQualityIndex: 15 + Math.round(rnd() * 70),
    altitude: 100 + Math.round(rnd() * 400),
    travelLeg: type === "TRAVEL" ? "Away leg (synthetic)" : null,
    timeZoneChangeHrs: type === "TRAVEL" ? 5 : null,
    daysSinceTravel: d % 9 === 0 ? 0 : d % 9,
  }));
  for (let i = 0; i < contextRows.length; i += 1000) {
    await prisma.footballContext.createMany({ data: contextRows.slice(i, i + 1000) });
  }
  console.log("Created training sessions with football contexts.");

  // ---- Interventions + reviews ----
  async function makeIntervention(
    externalId: string,
    exceptionKey: string,
    description: string,
    recommendation: string,
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    status: "OPEN" | "ASSIGNED" | "UNDER_REVIEW" | "FOLLOW_UP_REQUIRED" | "RESOLVED" | "DISMISSED",
    assignedTo?: string,
  ) {
    const athleteId = athleteByExternal.get(externalId);
    if (!athleteId) return;
    const teamId = teams[0].id;
    const created = await prisma.intervention.create({
      data: {
        teamId,
        athleteId,
        exceptionKey,
        description,
        recommendation,
        priority,
        status,
        assignedTo: assignedTo ?? (status === "OPEN" ? null : users.PERFORMANCE),
        suggestedWindow: priority === "CRITICAL" ? "Next 24h" : "Next 48h",
        triggeringScoreId: null,
      },
      select: { id: true },
    });
    if (status !== "OPEN") {
      await prisma.interventionReview.create({
        data: {
          interventionId: created.id,
          reviewerId: users.PERFORMANCE,
          statusChangeTo: status,
          notes: "Synthetic demo review.",
          followUpAction: recommendation,
        },
      });
    }
    return created;
  }

  await makeIntervention("EC-11", "MULTI_FAIL", "Multiple failed validity checks: calibration expired, sample integrity low.", "Request validation retest with recalibrated device.", "CRITICAL", "OPEN");
  await makeIntervention("EC-01", "CALIBRATION_STALE", "Device calibration older than 48h for QB capture.", "Inspect respiratory device calibration before next capture.", "HIGH", "OPEN");
  await makeIntervention("EC-12", "CONSENT_RESTRICTED", "Data access restricted by athlete; composite withheld.", "Confirm consent state with governance before next session.", "HIGH", "OPEN");
  await makeIntervention("EC-07", "LOAD_SPIKE", "Acute:chronic workload ratio above 1.5 threshold.", "Suggested recovery audit with performance staff.", "MEDIUM", "UNDER_REVIEW", users.PERFORMANCE);
  await makeIntervention("EC-07", "RECOVERY_REVIEW", "Prolonged suppressed recovery metrics.", "Human review of recovery trend and sleep context.", "MEDIUM", "FOLLOW_UP_REQUIRED", users.PERFORMANCE);
  const smithInt = await makeIntervention("EC-15", "RETEST_REQUESTED", "Requested validation retest after stale capture.", "Retest completed with fresh calibration.", "MEDIUM", "RESOLVED", users.PERFORMANCE);
  if (smithInt) {
    await prisma.interventionReview.create({
      data: {
        interventionId: smithInt.id,
        reviewerId: users.MEDICAL,
        statusChangeTo: "RESOLVED",
        notes: "Retest valid; composite restored.",
        followUpAction: "No further follow-up.",
      },
    });
  }
  console.log("Created interventions and reviews.");

  // ---- Import jobs ----
  await prisma.importJob.create({
    data: {
      dataSourceId: ds["CSV Import"],
      fileName: "demo_observations_week3.csv",
      status: "COMPLETED",
      totalRows: 480,
      processedRows: 480,
      errorRows: 0,
      log: { summary: "All rows valid (synthetic demo import)." } as unknown as Prisma.InputJsonValue,
      importedBy: users.PERFORMANCE,
    },
  });
  await prisma.importJob.create({
    data: {
      dataSourceId: ds["CSV Import"],
      fileName: "demo_bad_units.csv",
      status: "PARTIAL_SUCCESS",
      totalRows: 120,
      processedRows: 96,
      errorRows: 24,
      log: {
        summary: "24 rows rejected: inconsistent units (bpm vs brpm) and unknown metric key.",
        rejectedSample: [
          { row: 17, reason: "UNIT_MISMATCH", detail: "RESP_RATE expects brpm, got bpm" },
          { row: 42, reason: "UNKNOWN_METRIC", detail: "metricKey 'breatheRate' not in catalog" },
        ],
      } as unknown as Prisma.InputJsonValue,
      importedBy: users.PERFORMANCE,
    },
  });

  // ---- Reports ----
  await prisma.report.create({
    data: {
      name: "Team Readiness Summary — Week 3",
      reportType: "TEAM_SUMMARY",
      parameters: { teamId: teams[0].id, periodDays: 7 } as unknown as Prisma.InputJsonValue,
      generatedBy: users.PERFORMANCE,
      status: "COMPLETED",
    },
  });
  await prisma.report.create({
    data: {
      name: "Data Quality Review — Import Failures",
      reportType: "DATA_QUALITY",
      parameters: { windowDays: 14 } as unknown as Prisma.InputJsonValue,
      generatedBy: users.ADMIN,
      status: "COMPLETED",
    },
  });

  // ---- Audit (tamper-evident chain) ----
  const { audit } = await import("../src/lib/services/audit");
  await audit({
    userId: users.ADMIN,
    action: "SEED_CREATE",
    entityType: "System",
    entityId: null,
    newValue: { note: `Deterministic synthetic seed applied, phase 2 (demo environment).` },
    ipAddress: "127.0.0.1",
  });

  seedSummary.scores = scoreCount;
  seedSummary.withheld = withheldCount;
}

// helpers used above
function createdAthleteSpecs(list: { id: string; spec: AthleteSpec }[]) {
  return list.map(({ id, spec }) => ({ id, spec }));
}

/** Parallel map over chunks; keeps pool pressure bounded and preserves order. */
async function mapChunks<TIn, TOut>(
  items: TIn[],
  chunk: number,
  fn: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
  const out: TOut[] = [];
  for (let i = 0; i < items.length; i += chunk) {
    out.push(...await Promise.all(items.slice(i, i + chunk).map(fn)));
  }
  return out;
}
function calDev(spec: AthleteSpec): string {
  const map: Record<string, string> = {
    STALE_CAL: "DEV-012",
    MULTI_FAIL: "DEV-013",
    ORDINARY: "DEV-010",
    VALID_READY: "DEV-010",
    VALID_MONITOR: "DEV-011",
    LOAD_SPIKE: "DEV-011",
    CONSENT_RESTRICTED: "DEV-010",
    LOW_BASELINE: "DEV-014",
  };
  return map[spec.archetype] ?? "DEV-010";
}
function deviceLabelFor(serial: string): string {
  const defs: Record<string, string> = {
    "DEV-010": "O2-MASK-V1 (RespiroCorp)",
    "DEV-011": "CHEST-STRAP-X (BioFit)",
    "DEV-012": "O2-MASK-V1 (RespiroCorp)",
    "DEV-013": "O2-MASK-V1 (RespiroCorp)",
    "DEV-014": "GPS-POD-G3 (FieldSense)",
    "DEV-015": "ENV-STATION-1 (Aeris Labs)",
  };
  return defs[serial] ?? serial;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
