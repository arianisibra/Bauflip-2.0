import { getCurrentSession } from "@/lib/auth/session";
import { inviteEmployeeAction, listTeamMembersAction } from "@/app/(app)/einstellungen/actions";
import { InviteRoleSelect } from "@/components/app/invite-role-select";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function MitarbeiterPage() {
  const session = await getCurrentSession();
  const role = session?.role ?? "office";
  const isAdmin = role === "admin";
  const teamMembers = isAdmin ? await listTeamMembersAction() : [];
  const roleLabel: Record<"admin" | "office" | "technician", string> = {
    admin: "Admin",
    office: "Büro",
    technician: "Monteur",
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Mitarbeiter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teammitglieder verwalten und neue Mitarbeitende einladen.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Angemeldet als: <span className="font-medium text-foreground">{session?.user.email ?? "unbekannt"}</span>
          {" · "}
          erkannte Rolle: <span className="font-medium text-foreground">{role}</span>
        </p>
      </header>

      {!isAdmin ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="text-base">Eingeschränkter Zugriff</CardTitle>
            <CardDescription>
              Diese Seite ist für Admin-Funktionen vorgesehen. Aktuelle Rolle: {role}.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-5 sm:px-6">
          <CardTitle className="text-lg font-semibold tracking-tight">Mitarbeiter im Unternehmen</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Aktive Teammitglieder und offene Einladungen deiner Organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.length > 0 ? (
                teamMembers.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.displayName}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{roleLabel[row.role]}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleDateString("de-CH") : "—"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Noch keine Mitarbeitenden vorhanden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-5 sm:px-6">
          <CardTitle className="text-lg font-semibold tracking-tight">Mitarbeiter einladen</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Neue Benutzer erhalten einen Einladungslink und werden mit der gewählten Rolle freigeschaltet.
          </CardDescription>
        </CardHeader>
        <form action={inviteEmployeeAction}>
          <CardContent className="space-y-6 px-5 py-6 sm:px-6">
            <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="invite-email" className="text-sm font-medium">
                  E-Mail
                </Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="name@firma.ch"
                  required
                  autoComplete="email"
                  className="h-10 max-w-xl"
                />
              </div>
              <div className="flex max-w-xs flex-col gap-2">
                <Label htmlFor="invite-role" className="text-sm font-medium">
                  Rolle
                </Label>
                <InviteRoleSelect />
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <TurnstileField />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-muted-foreground">
              Der eingeladene Nutzer muss die Einladung in der E-Mail bestätigen.
            </p>
            <Button type="submit" className="w-full min-w-[11rem] sm:w-auto" disabled={!isAdmin}>
              Einladung senden
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
