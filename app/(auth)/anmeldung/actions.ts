"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isMockAuthEnabled } from "@/lib/auth/session";

export async function loginMockAction(formData: FormData) {
  if (!isMockAuthEnabled()) {
    throw new Error("Mock-Anmeldung ist in dieser Umgebung deaktiviert.");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "admin").trim();
  const role = roleInput === "monteur" ? "monteur" : "admin";

  if (!email || !password) {
    throw new Error("Bitte E-Mail und Passwort eingeben.");
  }

  const cookieStore = await cookies();
  cookieStore.set("bauflip_mock_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  cookieStore.set("bauflip_mock_role", role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  cookieStore.set("bauflip_mock_email", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/");
}
