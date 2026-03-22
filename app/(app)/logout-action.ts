"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutMockAction() {
  const cookieStore = await cookies();
  cookieStore.delete("bauflip_mock_auth");
  cookieStore.delete("bauflip_mock_role");
  cookieStore.delete("bauflip_mock_email");
  redirect("/anmeldung");
}
