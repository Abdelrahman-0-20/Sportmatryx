"use client";

import { highlightTextAll } from "@/lib/marketplace/highlight";

export function HighlightText({ text, query }: { text: string; query: string }) {
  const parts = highlightTextAll(text, query);
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "match" ? (
          <span key={i} className="rounded-sm bg-accent/20 text-canvas font-semibold">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
