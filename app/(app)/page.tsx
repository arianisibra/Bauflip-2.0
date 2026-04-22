import { redirect } from "next/navigation";

// Role-based routing happens in proxy.ts (middleware) before this renders.
// Kept as a safety net in case middleware is bypassed.
export default function AppRootPage() {
  redirect("/projekte");
}
