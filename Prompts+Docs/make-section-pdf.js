#!/usr/bin/env node
/* Zero-dependency PDF generator: Sportmetryx Section Guide (A4). */
const fs = require("fs");
const path = require("path");

const W = 595.28, H = 841.89, MARGIN = 40, CONTENT_W = W - MARGIN * 2;
const INK = [0.09, 0.15, 0.24], MUTED = [0.42, 0.5, 0.62], ACCENT = [0.12, 0.55, 0.68], BRAND = [0.04, 0.08, 0.16];

// Char widths for Helvetica/Helvetica-Bold at 1000upm (approx per standard AFM).
const HELV = { " ":278,"!":278,'"':355,"#":556,"$":556,"%":889,"&":667,"'":191,"(":333,")":333,"*":389,"+":584,",":278,"-":333,".":278,"/":278,"0":556,"1":556,"2":556,"3":556,"4":556,"5":556,"6":556,"7":556,"8":556,"9":556,":":278,";":278,"<":584,"=":584,">":584,"?":556,"@":1015,"A":667,"B":667,"C":722,"D":722,"E":667,"F":611,"G":778,"H":722,"I":278,"J":500,"K":667,"L":556,"M":833,"N":722,"O":778,"P":667,"Q":778,"R":722,"S":667,"T":611,"U":722,"V":667,"W":944,"X":667,"Y":667,"Z":611,"[":278,"\\":278,"]":278,"a":556,"b":556,"c":500,"d":556,"e":556,"f":278,"g":556,"h":556,"i":222,"j":222,"k":500,"l":222,"m":833,"n":556,"o":556,"p":556,"q":556,"r":333,"s":500,"t":278,"u":556,"v":500,"w":722,"x":500,"y":500,"z":500,"·":278,"—":1000,"–":556,"’":222,"×":584,"≥":549,"<":584,"“":333,"”":333,"°":400,"&":667,"’":222,"•":350,"|":260,"/":278,"(":333,")":333,"[":278,"]":278 };
const HELVB = Object.assign({}, HELV, { " ":278,"A":722,"B":722,"C":722,"D":722,"E":667,"F":611,"G":778,"H":722,"I":278,"J":556,"K":722,"L":611,"M":833,"N":722,"O":778,"P":667,"Q":778,"R":722,"S":667,"T":611,"U":722,"V":667,"W":944,"X":667,"Y":667,"Z":611,"a":556,"b":611,"c":556,"d":611,"e":556,"f":333,"g":611,"h":611,"i":278,"j":278,"k":556,"l":278,"m":889,"n":611,"o":611,"p":611,"q":611,"r":389,"s":556,"t":333,"u":611,"v":556,"w":778,"x":556,"y":556,"z":500,"0":556,"1":556,"2":556,"3":556,"4":556,"5":556,"6":556,"7":556,"8":556,"9":556,"-":333,".":278,",":278,":":333,"/":278,"(":333,")":333,"·":278,"—":1000,"×":584,"≥":549,"<":584,"&":722,"’":278,"•":350,"|":260 });
function charW(font, ch, size) { const t = font === "F2" ? HELVB : HELV; const u = t[ch] !== undefined ? t[ch] : 556; return (u / 1000) * size; }
function textW(font, text, size) { let w = 0; for (const ch of text) w += charW(font, ch, size); return w; }
function esc(s) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrap(font, text, size, maxW) {
  const words = text.split(/\s+/); const lines = []; let cur = "";
  for (const wd of words) {
    const trial = cur ? cur + " " + wd : wd;
    if (textW(font, trial, size) <= maxW) cur = trial;
    else { if (cur) lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur); return lines;
}

// ---------- Content model ----------
const sections = [
  { title: "1 · Access & Accounts", cards: [
    { t: "Landing Page", p: "/", what: "Public overview of the platform: the scoring model (READY / MONITOR / COMPROMISED), module map, and trust & audit principles.", ben: "New users understand the product before signing in; stakeholders can share a single link for demonstrations.", how: "Read the module cards, then use Sign in (existing account) or Continue as guest (read-only preview with synthetic data)." },
    { t: "Sign In", p: "/login", what: "Secure email + password login with role-based access control (RBAC). Sessions are cookie-based and server-verified.", ben: "Each role sees only what it should: no cross-role data leakage, fully auditable access.", how: "Enter any demo account (e.g. coach@demo.sportmetryx.dev) with password Demo-SMX-2024!. Guests use the guest link without an account." },
    { t: "Guest Mode", p: "/guest", what: "Read-only mode using synthetic sample data when you have no account (or the database is unreachable).", ben: "Investors, parents, or new staff can explore the full UI with zero risk to real data.", how: "Click Continue as guest on the landing page. All write actions (checkout, interventions) stay disabled and clearly labeled." },
    { t: "Admin Console", p: "/admin", what: "Administrator workspace for users, sessions, and system integrity (audit-chain verification).", ben: "One place to provision accounts, review activity, and confirm the tamper-evident audit log has no breaks.", how: "Sign in as admin@demo.sportmetryx.dev, review the user table, and run the audit-chain check to verify record integrity." },
  ]},
  { title: "2 · Performance Core", cards: [
    { t: "Roster", p: "/roster", what: "Searchable squad list with each athlete's current readiness band (READY >= 70, MONITOR 40-69, COMPROMISED < 40, or WITHHELD).", ben: "Coaches spot at-risk athletes in seconds instead of scanning spreadsheets.", how: "Filter by band or name; click any athlete row to open their full profile. Sort by readiness to triage training groups." },
    { t: "Athlete / Player Profile", p: "/player/[id]", what: "Deep individual view: score components, evidence quality (confidence), validity gates, history, and consent status.", ben: "Explains WHY an athlete scores as they do - never a black-box number; builds trust in decisions.", how: "From the roster, open a player. Review the component breakdown, check any WITHHELD reason (e.g. missing consent, stale baseline), then act in Team Command." },
    { t: "Team Command", p: "/team-command", what: "Squad-level command center: aggregated readiness, distribution across bands, and priority call-outs.", ben: "Answers the daily question 'who do I push, who do I protect?' in one screen.", how: "Each morning, scan the COMPROMISED / MONITOR lists, open flagged athletes, and plan the day's adjustments from there." },
    { t: "Game Readiness", p: "/game-readiness", what: "Match-day readiness projection per athlete, combining recent load, recovery, and score trend.", ben: "Objective input for selection meetings - pick the squad on evidence, not gut feel.", how: "Before match day, review projected readiness per position; discuss borderline athletes with the performance staff." },
    { t: "Position Room", p: "/position-room", what: "Readiness and scoring grouped by playing position (GK, DEF, MID, FWD).", ben: "Unit coaches see their own group in context; positional load differences become visible.", how: "Select a position tab to compare your unit; use it in unit-specific planning meetings." },
    { t: "Practice Command", p: "/practice-command", what: "Training-session view: who is ready to train fully, who needs modification, today.", ben: "Prevents overtraining - modifies sessions before injuries happen, not after.", how: "Check before each session; athletes in MONITOR / COMPROMISED get modified loads per the recommendations shown." },
    { t: "Recovery Command", p: "/recovery-command", what: "Recovery status overview: sleep, soreness, and recovery-trend signals feeding the score.", ben: "Makes recovery a managed resource, equal in priority to training load.", how: "Review after heavy training blocks; schedule extra recovery for athletes trending down across several days." },
  ]},
  { title: "3 · Care, Data Quality & Context", cards: [
    { t: "Interventions", p: "/interventions", what: "Create and track care actions (load reduction, medical referral, recovery protocol) linked to athlete scores.", ben: "Closes the loop: a risk signal leads to a documented action with a follow-up - nothing falls through the cracks.", how: "From a flagged athlete, open an intervention, choose the type and note, save; track its state until resolved. Every action is written to the audit log." },
    { t: "Data Quality", p: "/data-quality", what: "Validity-gates dashboard: calibration freshness, sample integrity, timestamp freshness, baseline sufficiency, consent state.", ben: "Shows WHICH data can be trusted today - scores fail closed when evidence is weak, so no decision rests on bad data.", how: "Review weekly; re-run imports or recalibrate devices for any gate shown as failing." },
    { t: "Environment & Travel", p: "/environment-travel", what: "Context layer for heat, travel, and scheduling factors that affect performance outside of training itself.", ben: "Separates 'he is declining' from 'he played in 35°C heat' - fairer evaluations, better trip planning.", how: "Around travel weeks, check environmental load alongside readiness to adjust expectations and plans." },
    { t: "Research", p: "/research", what: "Aggregate, anonymized analytics for sports-science staff: cohort trends and model calibration checks.", ben: "Turns months of session data into insight - validate the scoring model and find cohort patterns.", how: "Select a cohort and time range; export results for reports. Individual identities are never exposed here." },
    { t: "Digital Twin Simulation", p: "/player/[id]/twin", what: "'What-if' simulator: replay a training block with modified load and see the projected score outcome.", ben: "Test decisions safely - try a lighter week before committing to it in real life.", how: "From a player profile, open the twin, adjust the load parameter, run the simulation, and compare projected bands." },
  ]},
  { title: "4 · Marketplace (Demo Commerce)", cards: [
    { t: "Marketplace Listing", p: "/marketplace", what: "Catalog of data products: team data exports (derived from real import jobs) and synthetic sample datasets. Sellers can create listings with multiple product photos.", ben: "Shows the commercial layer of the platform - how data could be packaged and sold - with full honesty labels (every item is marked DEMO / synthetic).", how: "Browse or filter by tag, data type, and availability; search by name; open a product card for details and source summary; download a labeled sample CSV before 'buying'." },
    { t: "Sell a Product", p: "/marketplace/sell", what: "Listing creation form: name, description, price, and multiple image uploads with previews and re-ordering.", ben: "Team staff can package their own data products for sale - the marketplace becomes a two-sided store.", how: "From the marketplace, open Sell; fill the form, drag / select several photos (the first image becomes the cover), and publish. Images are stored on the server; uploads are validated by type and size." },
    { t: "Cart & Checkout", p: "/marketplace/cart", what: "Shopping cart with automatic calculation (price x quantity per line, grand total) and a demo checkout flow.", ben: "Complete commerce UX without touching real money - ideal for demos and stakeholder reviews.", how: "Add products with 'Add to cart' (the floating cart dialog shows live totals); open the full cart page, adjust quantities, then Check out. The checkout re-prices every item server-side and records a MARKETPLACE_DEMO_PURCHASE entry in the tamper-evident audit log. No payment processing, no money moved - always labeled demo." },
  ]},
  { title: "5 · The Scoring Model (Behind Every Screen)", cards: [
    { t: "How scores are built", p: "scoring engine", what: "Seven weighted components (fitness, load, recovery, sleep, soreness, readiness signals, context) normalized against each athlete's OWN baseline percentiles (p10 / p50 / p90).", ben: "Every athlete is measured against themselves, not the squad average - a 65 for a returning-injury player means something different than for a starter.", how: "Bands: READY >= 70 · MONITOR 40-69.9 · COMPROMISED < 40 · WITHHELD when evidence is insufficient." },
    { t: "Validity gates & audit trail", p: "trust layer", what: "Scores fail closed: if calibration is stale, consent is missing, samples are incomplete, or timestamps are old, the score is WITHHELD with an explicit reason.", ben: "The platform never presents a confident number built on weak evidence - this is the core trust guarantee.", how: "Every sensitive action (purchases, interventions, consent changes) is written to a SHA-256 hash-chained audit log that anyone can verify for tampering." },
  ]},
];

// ---------- Layout ----------
let page = []; const pages = [];
let y = 0, pageNum = 0;
function newPage() { if (page.length) pages.push(page); page = []; pageNum++; y = H; }
function need(h) { if (y - h < MARGIN + 26) newPage(); y -= h; }
function text(x, yy, txt, size, font, color) {
  const c = color || INK; const f = font || "F1";
  page.push(`BT ${f} ${size} Tf ${c[0]} ${c[1]} ${c[2]} rg 1 0 0 1 ${x.toFixed(2)} ${yy.toFixed(2)} Tm (${esc(txt)}) Tj ET`);
}
function rect(x, yy, w, h, color) {
  const c = color; page.push(`${c[0]} ${c[1]} ${c[2]} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
}
function strokeRect(x, yy, w, h, color, lw) {
  page.push(`${color[0]} ${color[1]} ${color[2]} RG ${lw || 0.7} w ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
}

function drawHeader(first) {
  // brand band
  rect(0, H - 92, W, 92, BRAND);
  rect(0, H - 95, W, 3, ACCENT);
  text(MARGIN, H - 52, "Sportmetryx", 22, "F2", [0.91, 0.94, 0.98]);
  text(MARGIN + textW("F2", "Sportmetryx", 22) + 8, H - 52, "Football", 22, "F1", [0.37, 0.82, 0.94]);
  text(MARGIN, H - 70, "Section Guide - what every section does, the benefit it delivers, and how to use it", 9.5, "F1", [0.66, 0.73, 0.84]);
  text(MARGIN, H - 84, "Summary edition · Demo password: Demo-SMX-2024! · All marketplace purchases are labeled DEMO - no real payments", 7.5, "F1", [0.5, 0.58, 0.7]);
  y = H - 112;
}
function drawFooter() {
  text(MARGIN, MARGIN - 14, "Sportmetryx Football · Section Guide · Page " + pageNum, 7.5, "F1", MUTED);
}
function sectionTitle(txt) {
  need(34);
  y -= 16;
  text(MARGIN, y, txt, 13, "F2", INK);
  const w = textW("F2", txt, 13);
  rect(MARGIN, y - 5, w + 4, 2.2, ACCENT);
  y -= 10;
}
function card(c) {
  const pad = 9;
  const colW = (CONTENT_W - 10) / 2;
  // measure
  const titleW = (font, size) => textW(font, c.t, size);
  const pathW = textW("F1", "  " + c.p, 7.5);
  const rows = [];
  let labelW = 0;
  for (const [lab, val] of [["WHAT IT IS", c.what], ["BENEFIT", c.ben], ["HOW TO USE", c.how]]) {
    labelW = Math.max(labelW, textW("F2", lab, 6.8) + 6);
  }
  const valW = colW - pad * 2 - labelW;
  let hgt = 22; // title row + padding
  for (const [lab, val] of [["WHAT IT IS", c.what], ["BENEFIT", c.ben], ["HOW TO USE", c.how]]) {
    const lines = wrap("F1", val, 8.2, valW);
    rows.push([lab, lines]);
    hgt += Math.max(9, lines.length * 10.5) + 4;
  }
  hgt += 4;
  // two-column flow: try placing at current x
  if (!card._x || card._x + colW + 10 > W - MARGIN) { if (card._x !== undefined && y - hgt < MARGIN + 30) newPage(); card._x = MARGIN; }
  else card._x = card._x + colW + 10;
  const x = card._x;
  if (x === MARGIN && y - hgt < MARGIN + 30) newPage();
  const top = y;
  // card bg + accent bar
  rect(x, top - hgt, colW, hgt, [0.965, 0.975, 0.988]);
  rect(x, top - hgt, 2.6, hgt, ACCENT);
  strokeRect(x, top - hgt, colW, hgt, [0.82, 0.87, 0.93], 0.6);
  // title
  let tx = x + pad + 4;
  text(tx, top - 14, c.t, 10, "F2", INK);
  const tw = titleW("F2", 10);
  if (tw + pathW < colW - pad * 2) text(tx + tw + 4, top - 13, c.p, 7.5, "F1", ACCENT);
  // rows
  let ry = top - 26;
  for (const [lab, lines] of rows) {
    text(tx, ry, lab, 6.8, "F2", ACCENT);
    for (const ln of lines) { ry -= 10.5; text(tx + labelW, ry, ln, 8.2, "F1", INK); }
    ry -= 4;
  }
  y = top - hgt - 8;
  card._x = x;
}
function endTwoCol() { card._x = undefined; }

newPage();
drawHeader(true);
for (const sec of sections) {
  sectionTitle(sec.title);
  endTwoCol();
  for (const c of sec.cards) card(c);
  endTwoCol();
  y -= 6;
}
drawFooter();
pages.push(page);

// ---------- Assemble PDF ----------
const objects = [];
function addObj(s) { objects.push(s); return objects.length; } // returns obj number

const numPages = pages.length;
// Deterministic numbering: obj1=F1, obj2=F2, then contents, then pages, then pages-tree, then catalog.
const f1n = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const f2n = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
const pagesTreeNum = 3 + numPages * 2;
const catalogNum = pagesTreeNum + 1;
const pageObjNums = [];
const contentNums = [];
for (let i = 0; i < numPages; i++) contentNums.push(addObj(null));
for (let i = 0; i < numPages; i++) pageObjNums.push(addObj(null));
for (let i = 0; i < numPages; i++) {
  objects[contentNums[i] - 1] = `<< /Length ${pages[i].join("\n").length + 1} >>\nstream\n${pages[i].join("\n")}\nendstream`;
  objects[pageObjNums[i] - 1] = `<< /Type /Page /Parent ${pagesTreeNum} 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 ${f1n} 0 R /F2 ${f2n} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`;
}
const kids = pageObjNums.map(n => `${n} 0 R`).join(" ");
objects[pagesTreeNum - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${numPages} >>`;
objects[catalogNum - 1] = `<< /Type /Catalog /Pages ${pagesTreeNum} 0 R >>`;

let out = "%PDF-1.4\n";
const offsets = [];
for (let i = 0; i < objects.length; i++) {
  offsets[i] = out.length;
  out += `${i + 1} 0 obj\n${objects[i] || "<< >>"}\nendobj\n`;
}
const xrefStart = out.length;
out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 0; i < objects.length; i++) out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
// NOTE: obj numbering shifts because pagesTree/catalog appended after page objs; offsets array is index-aligned (obj i+1 at offsets[i]).
const dest = path.join(__dirname, "sportmetryx-section-guide.pdf");
fs.writeFileSync(dest, out, "latin1");
console.log("Wrote", dest, numPages, "pages,", (out.length / 1024).toFixed(1), "KB");
