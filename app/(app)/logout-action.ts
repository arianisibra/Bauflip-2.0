"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/anmeldung");
}
