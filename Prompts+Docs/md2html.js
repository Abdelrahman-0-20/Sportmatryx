#!/usr/bin/env node
/**
 * Minimal markdown → branded HTML for LibreOffice PDF conversion.
 * Supports what pdf-source.md uses: # headings, bullets, bold, inline code,
 * paragraphs. No dependencies.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "pdf-source.md");
const OUT = path.join(__dirname, "business-value.html");

const md = fs.readFileSync(SRC, "utf8");

function inline(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code style="font-family:\'Courier New\',monospace;background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.92em;">$1</code>')
    .replace(/—/g, "&#8212;");
}

const lines = md.split("\n");
const body = [];
let inList = false;

function closeList() {
  if (inList) {
    body.push("</ul>");
    inList = false;
  }
}

for (const raw of lines) {
  const line = raw.trimEnd();
  const h = line.match(/^(#{1,6})\s+(.*)$/);
  if (h) {
    closeList();
    const level = h[1].length;
    if (level === 1) body.push(`<h1>${inline(h[2])}</h1>`);
    else if (level === 2) body.push(`<h2>${inline(h[2])}</h2>`);
    else body.push(`<h3>${inline(h[2])}</h3>`);
    continue;
  }
  const li = line.match(/^\s*[-*]\s+(.*)$/);
  if (li) {
    if (!inList) {
      body.push("<ul>");
      inList = true;
    }
    body.push(`<li>${inline(li[1])}</li>`);
    continue;
  }
  if (line.trim() === "") {
    closeList();
    continue;
  }
  closeList();
  body.push(`<p>${inline(line)}</p>`);
}
closeList();

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 2cm; }
  body {
    font-family: 'Georgia', serif;
    color: #1e293b;
    font-size: 11pt;
    line-height: 1.55;
    max-width: 17cm;
    margin: 0 auto;
  }
  h1 {
    font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif;
    font-size: 24pt;
    color: #0b1529;
    border-bottom: 3px solid #22d3ee;
    padding-bottom: 8px;
    margin: 0 0 18px 0;
  }
  h2 {
    font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif;
    font-size: 16pt;
    color: #0b1529;
    margin: 22px 0 8px 0;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
  }
  h3 {
    font-family: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif;
    font-size: 12.5pt;
    color: #155e75;
    margin: 16px 0 6px 0;
  }
  p { margin: 6px 0; }
  ul { margin: 6px 0 10px 0; padding-left: 22px; }
  li { margin: 3px 0; }
</style>
</head>
<body>
${body.join("\n")}
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${html.length} bytes)`);