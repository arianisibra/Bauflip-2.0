import { getCurrentSession } from "@/lib/auth/session";

export default async function DebugSessionPage() {
  const session = await getCurrentSession();

  return (
    <pre className="p-4 text-sm">
      {JSON.stringify(
        {
          hasSession: !!session,
          email: session?.user.email,
          role: session?.role,
          organizationId: session?.organizationId,
        },
        null,
        2,
      )}
    </pre>
  );
}

