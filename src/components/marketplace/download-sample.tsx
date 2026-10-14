"use client";

import { Button } from "@/components/ui/primitives";
import { samplePreviewCsv, samplePreviewFileName, samplePreviewNote } from "@/lib/marketplace/sample-previews";
import type { MarketProduct } from "@/lib/services/marketplace";

export function DownloadSamplePreview({ product }: { product: MarketProduct }) {
  function download() {
    const csv = samplePreviewCsv(product);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = samplePreviewFileName(product);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button variant="ghost" onClick={download} className="w-fit text-xs">
        Download sample preview
      </Button>
      <span className="text-[11px] text-muted">{samplePreviewNote(product)}</span>
    </div>
  );
}
