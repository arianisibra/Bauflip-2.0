import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Bauflip Organisation";

if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
  throw new Error(
    "Missing env. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_ADMIN_EMAIL",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  throw new Error(`Could not list users: ${listError.message}`);
}

const authUser = usersData.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase());
if (!authUser) {
  throw new Error(`No auth user found for ${adminEmail}. Create the user first via invite.`);
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: authUser.id,
    email: adminEmail.toLowerCase(),
    display_name: authUser.user_metadata?.display_name ?? adminEmail.split("@")[0],
    role: "admin",
    avatar_url: null,
  },
  { onConflict: "id" },
);
if (profileError) {
  throw new Error(`Could not upsert profile: ${profileError.message}`);
}

const { data: existingOrg, error: orgLookupError } = await admin
  .from("organizations")
  .select("id")
  .limit(1)
  .maybeSingle();
if (orgLookupError) {
  throw new Error(`Could not check organization: ${orgLookupError.message}`);
}

let organizationId = existingOrg?.id as string | undefined;
if (!organizationId) {
  const { data: newOrg, error: createOrgError } = await admin
    .from("organizations")
    .insert({
      name: organizationName,
      created_by: authUser.id,
    })
    .select("id")
    .single();
  if (createOrgError || !newOrg) {
    throw new Error(`Could not create organization: ${createOrgError?.message ?? "unknown error"}`);
  }
  organizationId = newOrg.id as string;
}

const { error: membershipError } = await admin.from("organization_memberships").upsert(
  {
    organization_id: organizationId,
    user_id: authUser.id,
    role: "admin",
    is_active: true,
  },
  { onConflict: "organization_id,user_id" },
);
if (membershipError) {
  throw new Error(`Could not create membership: ${membershipError.message}`);
}

console.log("Bootstrap completed.");
console.log(`Admin: ${adminEmail}`);
console.log(`Organization ID: ${organizationId}`);
