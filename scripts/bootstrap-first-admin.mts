import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Bauflip Organisation";

const missing: string[] = [];
if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!adminEmail) missing.push("BOOTSTRAP_ADMIN_EMAIL");

if (missing.length > 0) {
  throw new Error(
    `Missing or empty env in .env.local: ${missing.join(", ")}. ` +
      "Tip: npm run bootstrap:first-admin loads .env.local via Node --env-file. " +
      "Add BOOTSTRAP_ADMIN_EMAIL=deine@email.ch and paste the service_role key from Supabase Dashboard → Settings → API.",
  );
}

const admin = createClient(supabaseUrl as string, serviceRoleKey as string, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bootstrapEmail = adminEmail as string;

const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  throw new Error(`Could not list users: ${listError.message}`);
}

const authUser = usersData.users.find((user) => user.email?.toLowerCase() === bootstrapEmail.toLowerCase());
if (!authUser) {
  throw new Error(`No auth user found for ${bootstrapEmail}. Create the user first via invite.`);
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: authUser.id,
    role: "admin",
    display_name:
      String(authUser.user_metadata?.display_name ?? "").trim() || bootstrapEmail.split("@")[0],
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

// Mirror role into user_metadata so the middleware can read it without a DB lookup.
const { error: metaError } = await admin.auth.admin.updateUserById(authUser.id, {
  user_metadata: { ...authUser.user_metadata, role: "admin" },
});
if (metaError) {
  throw new Error(`Could not set user_metadata.role: ${metaError.message}`);
}

console.log("Bootstrap completed.");
console.log(`Admin: ${bootstrapEmail}`);
console.log(`Organization ID: ${organizationId}`);
