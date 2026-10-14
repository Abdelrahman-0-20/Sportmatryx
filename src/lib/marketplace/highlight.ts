/**
 * Client-safe search highlighting helper.
 * Splits text around the query and wraps matches in a highlight span.
 */

export function highlightText(text: string, query: string): { before: string; match: string; after: string } | null {
  if (!query.trim()) return null;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length),
  };
}

export function highlightTextAll(text: string, query: string): Array<{ kind: "text" | "match"; text: string }> {
  if (!query.trim()) return [{ kind: "text", text }];
  const q = query.trim();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return [{ kind: "text", text }];
  return [
    { kind: "text", text: text.slice(0, idx) },
    { kind: "match", text: text.slice(idx, idx + q.length) },
    { kind: "text", text: text.slice(idx + q.length) },
  ];
}
