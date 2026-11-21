"use client";

import { useTr } from "@/components/ui-lang";

export function PrintButton() {
  const tr = useTr();
  return (
    <button type="button" className="btn-accent h-12 w-full" onClick={() => window.print()}>
      {tr("Распечатать", "Басып шығару")}
    </button>
  );
}
