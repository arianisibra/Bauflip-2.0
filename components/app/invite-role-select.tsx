"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteRoleSelect() {
  const [role, setRole] = useState("technician");

  return (
    <>
      <input type="hidden" name="role" value={role} />
      <Select value={role} onValueChange={(v) => setRole(String(v))}>
        <SelectTrigger id="invite-role" className="h-9 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="technician">Monteur</SelectItem>
          <SelectItem value="office">Büro</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
