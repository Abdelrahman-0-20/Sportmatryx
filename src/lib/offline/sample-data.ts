import type { RosterRow, TeamOverview } from "@/lib/services/dashboard";
import type { AthleteDetail } from "@/lib/services/athlete";
import type { InterventionRow } from "@/lib/services/interventions";

/**
 * SYNTHETIC SAMPLE DATA for guest / offline demo mode.
 *
 * IMPORTANT HONESTY RULE (spec §25): this must NEVER be presented as real
 * athlete data. Every page that renders these shows the offline-demo banner
 * and the data is explicitly labeled "synthetic sample". It exists so the
 * application remains fully demonstrable when the database is unreachable
 * (e.g. a Vercel deployment without a live DATABASE_URL) — not to fake a
 * backend.
 */

export const SAMPLE_ROSTER: RosterRow[] = [
  { athleteId: "guest-ath-10", externalId: "EC-10", displayName: "Calhoun, E.", position: "SKILL", positionGroup: "SKILL", teamId: "team-demo", teamName: "Ironmark Stallions", score: 81.4, band: "READY", confidence: 94, validity: "VALID", withheldCode: null, timestamp: new Date().toISOString(), openExceptions: 0, maxSeverity: null },
  { athleteId: "guest-ath-07", externalId: "EC-07", displayName: "Jennings, J.", position: "TRENCH", positionGroup: "TRENCH", teamId: "team-demo", teamName: "Ironmark Stallions", score: 58.2, band: "MONITOR", confidence: 88, validity: "VALID", withheldCode: null, timestamp: new Date().toISOString(), openExceptions: 2, maxSeverity: "MODERATE" },
  { athleteId: "guest-ath-01", externalId: "EC-01", displayName: "Calloway, E.", position: "QB", positionGroup: "QB", teamId: "team-demo", teamName: "Ironmark Stallions", score: null, band: "WITHHELD", confidence: null, validity: "WITHHELD", withheldCode: "CALIBRATION_FRESHNESS", timestamp: new Date().toISOString(), openExceptions: 1, maxSeverity: "HIGH" },
  { athleteId: "guest-ath-11", externalId: "EC-11", displayName: "Colter, E.", position: "TRENCH", positionGroup: "TRENCH", teamId: "team-demo", teamName: "Ironmark Stallions", score: null, band: "WITHHELD", confidence: null, validity: "RETEST", withheldCode: "MULTI_FAIL", timestamp: new Date().toISOString(), openExceptions: 4, maxSeverity: "CRITICAL" },
  { athleteId: "guest-ath-12", externalId: "EC-12", displayName: "Crane, E.", position: "SKILL", positionGroup: "SKILL", teamId: "team-demo", teamName: "Ironmark Stallions", score: null, band: "WITHHELD", confidence: null, validity: "WITHHELD", withheldCode: "CONSENT_STATE", timestamp: new Date().toISOString(), openExceptions: 1, maxSeverity: "HIGH" },
  { athleteId: "guest-ath-64", externalId: "EC-64", displayName: "Reyes, D.", position: "LB_TE", positionGroup: "LB_TE", teamId: "team-demo", teamName: "Ironmark Stallions", score: 75.0, band: "READY", confidence: 91, validity: "VALID", withheldCode: null, timestamp: new Date().toISOString(), openExceptions: 0, maxSeverity: null },
  { athleteId: "guest-ath-22", externalId: "EC-22", displayName: "Silva, M.", position: "ST", positionGroup: "ST", teamId: "team-demo", teamName: "Ironmark Stallions", score: null, band: "WITHHELD", confidence: null, validity: "INSUFFICIENT_BASELINE", withheldCode: "BASELINE_SUFFICIENCY", timestamp: new Date().toISOString(), openExceptions: 0, maxSeverity: null },
  { athleteId: "guest-ath-31", externalId: "EC-31", displayName: "Tanaka, A.", position: "SKILL", positionGroup: "SKILL", teamId: "team-demo", teamName: "Ironmark Stallions", score: 66.8, band: "MONITOR", confidence: 79, validity: "VALID", withheldCode: null, timestamp: new Date().toISOString(), openExceptions: 1, maxSeverity: "MODERATE" },
  { athleteId: "guest-ath-44", externalId: "EC-44", displayName: "Woo, K.", position: "QB", positionGroup: "QB", teamId: "team-demo", teamName: "Ironmark Stallions", score: 72.1, band: "READY", confidence: 90, validity: "VALID", withheldCode: null, timestamp: new Date().toISOString(), openExceptions: 0, maxSeverity: null },
];

export const SAMPLE_OVERVIEW = (): TeamOverview => ({
  roster: SAMPLE_ROSTER,
  counts: { ready: SAMPLE_ROSTER.filter((r) => r.band === "READY").length, monitor: SAMPLE_ROSTER.filter((r) => r.band === "MONITOR").length, compromised: 0, withheld: SAMPLE_ROSTER.filter((r) => r.band === "WITHHELD").length },
  openExceptions: SAMPLE_ROSTER.reduce((a, r) => a + r.openExceptions, 0),
  criticalHighExceptions: SAMPLE_ROSTER.filter((r) => r.maxSeverity === "CRITICAL" || r.maxSeverity === "HIGH").length,
  positionSummaries: [
    { position: "SKILL", avgScore: 74.1, ready: 1, total: 3 },
    { position: "TRENCH", avgScore: 58.2, ready: 0, total: 2 },
    { position: "QB", avgScore: 72.1, ready: 1, total: 2 },
    { position: "LB_TE", avgScore: 75.0, ready: 1, total: 1 },
    { position: "ST", avgScore: null, ready: 0, total: 1 },
  ],
  recentSessions: [
    { id: "s1", athleteName: "Calhoun, E.", sessionType: "PRACTICE", date: new Date(Date.now() - 3600000).toISOString(), durationMinutes: 110, intensity: "High", venue: "Ironmark Stallions Field", temperature: 24, airQualityIndex: 18 },
    { id: "s2", athleteName: "Jennings, J.", sessionType: "GAME", date: new Date(Date.now() - 200000).toISOString(), durationMinutes: 180, intensity: "High", venue: "Ironmark Stallions Field", temperature: 26, airQualityIndex: 22 },
    { id: "s3", athleteName: "Reyes, D.", sessionType: "RECOVERY", date: new Date(Date.now() - 7200000).toISOString(), durationMinutes: 45, intensity: "Low", venue: "Ironmark Stallions Field", temperature: 21, airQualityIndex: 15 },
  ],
  recentBaselineChanges: [
    { athleteId: "guest-ath-10", athleteName: "Calhoun, E.", metric: "HRV_MS", note: "Rolling 28-day synthetic baseline.", updatedAt: new Date().toISOString() },
    { athleteId: "guest-ath-64", athleteName: "Reyes, D.", metric: "JUMP_CM", note: "Rolling 28-day synthetic baseline.", updatedAt: new Date().toISOString() },
  ],
});

export const SAMPLE_INTERVENTIONS: InterventionRow[] = [
  { id: "gi-1", athleteId: "guest-ath-11", athleteName: "Colter, E.", teamId: "team-demo", exceptionKey: "MULTI_FAIL", description: "Multiple failed validity checks: calibration expired, sample integrity low.", recommendation: "Request validation retest with recalibrated device.", priority: "CRITICAL", status: "OPEN", suggestedWindow: "Next 24h", createdAt: new Date().toISOString(), reviews: [] },
  { id: "gi-2", athleteId: "guest-ath-01", athleteName: "Calloway, E.", teamId: "team-demo", exceptionKey: "CALIBRATION_STALE", description: "Device calibration older than 48h for QB capture.", recommendation: "Inspect respiratory device calibration before next capture.", priority: "HIGH", status: "OPEN", suggestedWindow: "Next 48h", createdAt: new Date().toISOString(), reviews: [] },
  { id: "gi-3", athleteId: "guest-ath-12", athleteName: "Crane, E.", teamId: "team-demo", exceptionKey: "CONSENT_RESTRICTED", description: "Data access restricted by athlete; composite withheld.", recommendation: "Confirm consent state with governance before next session.", priority: "HIGH", status: "OPEN", suggestedWindow: "Next 48h", createdAt: new Date().toISOString(), reviews: [] },
  { id: "gi-4", athleteId: "guest-ath-07", athleteName: "Jennings, J.", teamId: "team-demo", exceptionKey: "LOAD_SPIKE", description: "Acute:chronic workload ratio above 1.5 threshold.", recommendation: "Suggested recovery audit with performance staff.", priority: "MEDIUM", status: "UNDER_REVIEW", suggestedWindow: "Next 48h", createdAt: new Date().toISOString(), reviews: [] },
  { id: "gi-5", athleteId: "guest-ath-07", athleteName: "Jennings, J.", teamId: "team-demo", exceptionKey: "RECOVERY_REVIEW", description: "Prolonged suppressed recovery metrics.", recommendation: "Human review of recovery trend and sleep context.", priority: "MEDIUM", status: "FOLLOW_UP_REQUIRED", suggestedWindow: "Before next capture", createdAt: new Date().toISOString(), reviews: [] },
];

export const SAMPLE_ATHLETE = (id: string): AthleteDetail => ({
  athlete: {
    id,
    externalId: "EC-10",
    displayName: "Ethan Calhoun",
    position: "SKILL",
    rosterRole: "Starter",
    isActive: true,
    teamName: "Ironmark Stallions",
    teamId: "team-demo",
  },
  consent: { status: "GRANTED", reason: "Baseline demo consent for synthetic data.", grantedAt: new Date().toISOString() },
  latestScore: {
    id: `${id}-score`,
    timestamp: new Date().toISOString(),
    score: 81.4,
    band: "READY",
    confidence: 94,
    validity: "VALID",
    withheldCode: null,
    explanation: "Composite valid. Prototype model — decision support only, not a medical device.",
    components: [
      { name: "RESPIRATORY_EFFICIENCY", score: 0.84, weight: 0.2, contribution: 16.8, reason: null },
      { name: "OXYGEN_FUNCTION", score: 0.91, weight: 0.1, contribution: 9.1, reason: null },
      { name: "RECOVERY_AUTONOMIC", score: 0.78, weight: 0.2, contribution: 15.6, reason: null },
      { name: "WORKLOAD_RESPONSE", score: 0.8, weight: 0.2, contribution: 16.0, reason: null },
      { name: "MOVEMENT_EXPLOSIVE", score: 0.82, weight: 0.15, contribution: 12.3, reason: null },
      { name: "ENVIRONMENT_TRAVEL", score: 0.5, weight: 0.05, contribution: 2.5, reason: null },
      { name: "BASELINE_DEVIATION", score: 0.94, weight: 0.1, contribution: 9.4, reason: null },
    ],
    drivers: [
      { type: "POSITIVE", text: "Baseline Deviation +9.4 pts vs own baseline", strength: 9.4 },
      { type: "POSITIVE", text: "Respiratory Efficiency +16.8 pts vs own baseline", strength: 16.8 },
      { type: "NEGATIVE", text: "Environment & Travel −2.5 pts vs own baseline", strength: 2.5 },
    ],
    checks: [
      { name: "CONSENT_STATE", status: "PASSED", reason: "Consent granted." },
      { name: "CALIBRATION_FRESHNESS", status: "PASSED", reason: "Calibration fresh (2h)." },
      { name: "SAMPLE_INTEGRITY", status: "PASSED", reason: "Sample integrity OK (ratio 96%, signal ≥ 0.9)." },
      { name: "BASELINE_SUFFICIENCY", status: "PASSED", reason: "Baselines sufficient (n ≥ 8 in 28d window)." },
      { name: "TIMESTAMP_FRESHNESS", status: "PASSED", reason: "Capture fresh (6h)." },
    ],
  },
  trend: [74, 76, 77, 75, 78, 79, 80, 79, 81, 80, null, 81, 81, 81.4],
  baseline: {
    id: `${id}-bl`,
    status: "ACTIVE",
    version: 1,
    notes: "Rolling 28-day synthetic baseline for EC-10.",
    observations: [
      { metric: "RESP_RATE", p10: 13, p50: 16, p90: 19, n: 27 },
      { metric: "SPO2", p10: 95, p50: 97, p90: 99, n: 27 },
      { metric: "HRV_MS", p10: 74, p50: 86, p90: 99, n: 27 },
      { metric: "RHR", p10: 48, p50: 51, p90: 55, n: 27 },
      { metric: "SLEEP_H", p10: 7.1, p50: 7.8, p90: 8.5, n: 27 },
    ],
  },
  sessions: [
    { id: "gs1", type: "GAME", date: new Date(Date.now() - 200000).toISOString(), durationMinutes: 180, intensity: "High", venue: "Ironmark Stallions Field", temperature: 26, airQualityIndex: 22, opponent: "Cross-town Club" },
    { id: "gs2", type: "PRACTICE", date: new Date(Date.now() - 3600000).toISOString(), durationMinutes: 110, intensity: "High", venue: "Ironmark Stallions Field", temperature: 24, airQualityIndex: 18, opponent: null },
  ],
  interventions: [],
  devices: [
    { serialNumber: "DEV-010", model: "O2-MASK-V1", calibrationStatus: "OK", calibratedAt: new Date(Date.now() - 7200000).toISOString() },
  ],
});