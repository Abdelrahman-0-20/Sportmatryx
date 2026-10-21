"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * Product photo picker for locally-stored marketplace listings.
 *
 * HONESTY RULE (matches sell-listing.tsx): photos are read, downscaled and held
 * in browser memory/localStorage only. They are never transmitted to any server.
 */

export const MAX_LISTING_PHOTOS = 5;
const MAX_EDGE_PX = 1200;
const JPEG_QUALITY = 0.8;
const MAX_STORED_BYTES = 1_000_000; // ~1MB per photo after downscale

/** Downscale an image file to a compact JPEG data URL, client-side only. */
async function fileToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image"));
      el.src = objectUrl;
    });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface ListingImagesValue {
  images: string[];
  setImages: (images: string[]) => void;
}

export function ListingImages({ value, onChange, error }: {
  value: string[];
  onChange: (images: string[]) => void;
  error?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shownError = error ?? localError;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      setLocalError("Please choose image files (PNG, JPG or WebP).");
      return;
    }
    const remaining = MAX_LISTING_PHOTOS - value.length;
    if (remaining <= 0) {
      setLocalError(`Maximum ${MAX_LISTING_PHOTOS} photos per listing.`);
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const accepted: string[] = [];
      let skipped = 0;
      for (const file of incoming) {
        if (accepted.length >= remaining) { skipped++; continue; }
        try {
          const dataUrl = await fileToDataUrl(file);
          if (dataUrl.length > MAX_STORED_BYTES) { skipped++; continue; }
          accepted.push(dataUrl);
        } catch {
          skipped++;
        }
      }
      if (accepted.length > 0) onChange([...value, ...accepted]);
      if (accepted.length + value.length >= MAX_LISTING_PHOTOS && skipped > 0) {
        setLocalError(`Maximum ${MAX_LISTING_PHOTOS} photos per listing — ${skipped} file(s) skipped.`);
      } else if (skipped > 0) {
        setLocalError(`${skipped} file(s) skipped — unreadable or too large after resizing.`);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onChange, value]);

  const removeAt = (index: number) => {
    setLocalError(null);
    onChange(value.filter((_, i) => i !== index));
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    setLocalError(null);
    const next = [...value];
    const [picked] = next.splice(index, 1);
    onChange([picked, ...next]);
  };

  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">Product photos (up to {MAX_LISTING_PHOTOS})</span>

      <div
        role="button"
        tabIndex={0}
        aria-label="Add product photos"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) void addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-xs transition-colors focus:border-accent focus:outline-none ${
          dragOver ? "border-accent bg-accent/10" : "border-edge bg-panel-2 hover:border-accent/60"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span className="text-sm font-semibold text-ink">
          {busy ? "Processing photos…" : "Drop photos here or click to browse"}
        </span>
        <span className="text-muted">
          {value.length}/{MAX_LISTING_PHOTOS} selected · resized to max 1200px in your browser
        </span>
        <span className="text-[11px] text-muted">Resized in your browser · stored in the app database when you publish.</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
        }}
      />

      {shownError ? (
        <p role="alert" className="text-xs text-critical">{shownError}</p>
      ) : null}

      {value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((src, i) => (
            <li key={`${i}-${src.slice(-16)}`} className="group relative overflow-hidden rounded-md border border-edge bg-panel-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URLs, not remote files */}
              <img
                src={src}
                alt={i === 0 ? "Listing cover photo" : `Listing photo ${i + 1}`}
                className="h-24 w-full object-cover"
              />
              {i === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded-full border border-accent/50 bg-panel/80 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(i)}
                  className="absolute left-1.5 top-1.5 rounded-full border border-edge bg-panel/80 px-2 py-0.5 text-[10px] font-semibold text-muted opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-panel/80 text-xs text-muted transition-colors hover:border-critical/60 hover:text-critical"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-muted">
        The first photo is the cover shown on the listing card. Use only fictional/synthetic product images.
      </p>

      {value.length === 0 ? null : (
        <div>
          <Button
            variant="ghost"
            onClick={() => { setLocalError(null); onChange([]); }}
            className="text-xs"
            aria-label="Remove all photos"
          >
            Remove all photos
          </Button>
        </div>
      )}
    </div>
  );
}
