"use client";

import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function ProjekteHydrationBoundary({
  state,
  children,
}: Readonly<{
  state: DehydratedState;
  children: ReactNode;
}>) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
