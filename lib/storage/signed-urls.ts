import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Kurzlebige signierte URLs für private Projektdateien (Pfad = Storage-Objektname im Bucket). */
export async function getProjectFileSignedUrl(
  storagePath: string,
  expiresSec = 3600,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from("project-files")
    .createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}
