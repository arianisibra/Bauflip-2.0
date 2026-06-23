"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buildAuftragHref } from "@/lib/navigation/tech-field-navigation";

export function TechAuftragLink({
  projectId,
  returnTo,
  className,
  children,
}: Readonly<{
  projectId: string;
  returnTo: string;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <Link href={buildAuftragHref(projectId, returnTo)} prefetch={false} className={className}>
      {children}
    </Link>
  );
}
