"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StockDecisionSelect() {
  const [decision, setDecision] = useState("ab_lager");

  return (
    <>
      <input type="hidden" name="decision" value={decision} />
      <Select value={decision} onValueChange={(v) => setDecision(String(v))}>
        <SelectTrigger id="decision" className="h-9 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ab_lager">Ab Lager</SelectItem>
          <SelectItem value="bestellen">Bestellen</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
