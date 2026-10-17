// One-off: export every Prisma model to CSV in data-export/
import fs from "node:fs";

// Load .env manually (dotenv is not a direct dependency).
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const MODELS = [
  "user", "account", "session", "team", "teamMembership", "athlete",
  "consentRecord", "positionConfiguration", "device", "calibrationRecord",
  "observation", "dataSource", "importJob", "trainingSession",
  "footballContext", "athleteBaseline", "baselineObservation",
  "performanceModel", "modelConfigurationVersion", "performanceScore",
  "scoreComponent", "scoreDriver", "validityCheck", "intervention",
  "interventionReview", "report", "auditLog",
];

const REDACT = new Set(["passwordHash", "tokenHash", "accessToken", "refreshToken", "idToken"]);

function esc(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

fs.mkdirSync("data-export", { recursive: true });
const summary = [];

for (const model of MODELS) {
  const delegate = prisma[model];
  if (!delegate) { summary.push([model, "MISSING DELEGATE"]); continue; }
  const rows = await delegate.findMany();
  const headers = new Set();
  for (const r of rows) for (const k of Object.keys(r)) headers.add(k);
  const cols = [...headers];
  let csv = cols.map(esc).join(",") + "\n";
  for (const r of rows) {
    csv += cols.map((c) => {
      let v = r[c];
      if (REDACT.has(c) && v) v = "[REDACTED]";
      return esc(v);
    }).join(",") + "\n";
  }
  fs.writeFileSync(`data-export/${model}.csv`, csv);
  summary.push([model, rows.length]);
}

console.log("model,rows");
for (const [m, n] of summary) console.log(`${m},${n}`);
await prisma.$disconnect();