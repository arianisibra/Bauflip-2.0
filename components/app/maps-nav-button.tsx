"use client";

import { Navigation } from "lucide-react";

export function MapsNavButton({ address }: { address: string }) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary active:scale-95"
    >
      <Navigation className="size-3.5" />
    </a>
  );
}
