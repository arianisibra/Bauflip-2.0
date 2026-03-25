"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type ListPageToolbarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function ListPageToolbar({ value, onChange, placeholder = "Suchen…" }: ListPageToolbarProps) {
  return (
    <div className="relative w-full min-w-[200px] max-w-md flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
        autoComplete="off"
      />
    </div>
  );
}
