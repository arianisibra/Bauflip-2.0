/**
 * One-time backfill: mirror active organization_memberships into auth user_metadata
 * (role + organization_id) so proxy.ts can skip the membership DB query.
 *
 * Usage: npx tsx --env-file=.env.local scripts/sync-user-auth-metadata.mts
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: memberships, error: memErr } = await admin
  .from("organization_memberships")
  .select("user_id, role, organization_id")
  .eq("is_active", true)
  .order("created_at", { ascending: true });

if (memErr) {
  throw new Error(`Membership query failed: ${memErr.message}`);
}

const byUser = new Map<string, { role: string; organization_id: string }>();
for (const row of memberships ?? []) {
  const uid = String(row.user_id);
  if (!byUser.has(uid)) {
    byUser.set(uid, {
      role: String(row.role),
      organization_id: String(row.organization_id),
    });
  }
}

let updated = 0;
let failed = 0;

for (const [userId, { role, organization_id }] of byUser) {
  const { data: userData, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !userData.user) {
    console.warn(`Skip ${userId}: ${getErr?.message ?? "user not found"}`);
    failed += 1;
    continue;
  }
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      role,
      organization_id,
    },
  });
  if (updErr) {
    console.warn(`Failed ${userId}: ${updErr.message}`);
    failed += 1;
  } else {
    updated += 1;
  }
}

console.log(`sync-user-auth-metadata: ${updated} updated, ${failed} failed/skipped.`);
