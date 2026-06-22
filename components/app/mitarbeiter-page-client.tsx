"use client";

import Link from "next/link";
import { useSessionProfile } from "@/components/app/session-profile-provider";
import { inviteEmployeeAction, type TeamMemberListItem } from "@/app/(app)/einstellungen/actions";
import { InviteEmployeeSubmitButton } from "@/components/app/invite-employee-submit-button";
import { InviteRoleSelect } from "@/components/app/invite-role-select";
import { AbsencesManager } from "@/components/app/absences-manager";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTeamMembers } from "@/lib/query/hooks";
import type { LucideIcon } from "lucide-react";
import { Calendar, Layers, Mail, UserPlus, Users } from "lucide-react";

const roleLabel: Record<"admin" | "office" | "technician", string> = {
  admin: "Admin",
  office: "Büro",
  technician: "Monteur",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}

function RoleBadge({ role }: { role: TeamMemberListItem["role"] }) {
  const label = roleLabel[role];
  const cls =
    role === "admin"
      ? "border-primary/25 bg-primary/10 text-primary"
      : role === "office"
        ? "border-violet-500/20 bg-violet-500/10 text-violet-800 dark:text-violet-200"
        : "border-border bg-muted/50 text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {label}
    </Badge>
  );
}

function MemberAvatar({
  row,
  currentUserId,
}: {
  row: TeamMemberListItem;
  currentUserId: string | undefined;
}) {
  const isSelf =
    row.status === "aktiv" && row.userId != null && currentUserId != null && row.userId === currentUserId;
  const baseClass =
    "relative flex size-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60 transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const inner =
    row.avatarUrl != null ? (
      <img src={row.avatarUrl} alt="" className="size-full object-cover" />
    ) : (
      <span className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
        {initials(row.displayName)}
      </span>
    );

  if (isSelf) {
    return (
      <Link
        href="/einstellungen"
        prefetch={false}
        className={cn(baseClass, "hover:ring-2 hover:ring-primary/45")}
        title="Profil und Profilbild bearbeiten"
      >
        {inner}
      </Link>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}

function StatusBadge({ status }: { status: TeamMemberListItem["status"] }) {
  if (status === "aktiv") {
    return (
      <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 font-medium text-emerald-800 dark:text-emerald-200">
        Aktiv
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 font-medium text-amber-900 dark:text-amber-100">
      Eingeladen
    </Badge>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function MitarbeiterPageClient() {
  const profile = useSessionProfile();
  const isAdmin = profile.role === "admin";

  const { data: teamMembers = [] } = useTeamMembers(isAdmin);

  if (!isAdmin) {
    return null;
  }

  const activeCount = teamMembers.filter((m) => m.status === "aktiv").length;
  const pendingCount = teamMembers.filter((m) => m.status === "eingeladen").length;
  const currentUserId = profile.userId;
  const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Mitarbeiter</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Team verwalten, Rollen zuweisen und neue Kolleginnen und Kollegen per E-Mail einladen.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start xl:grid-cols-[minmax(0,1fr)_min(100%,24rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatChip label="Aktive Profile" value={activeCount} icon={Users} />
            <StatChip label="Offene Einladungen" value={pendingCount} icon={Mail} />
            <StatChip label="Einträge gesamt" value={teamMembers.length} icon={Layers} />
          </div>

          <Card size="sm" className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-semibold tracking-tight">Team in Ihrer Organisation</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Aktive Mitglieder und ausstehende Einladungen.
                  </CardDescription>
                </div>
                <AbsencesManager />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0 pt-0">
              <Table>
                <TableHeader className="bg-muted/20 [&_tr]:border-border/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 w-[40%] pl-4 text-xs font-medium text-muted-foreground">Person</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Rolle</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="h-9 pr-4 text-right text-xs font-medium text-muted-foreground">Seit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.length > 0 ? (
                    teamMembers.map((row) => (
                      <TableRow key={row.key} className="border-border/50">
                        <TableCell className="pl-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <MemberAvatar row={row} currentUserId={currentUserId} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{row.displayName}</p>
                              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={row.role} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="pr-4 text-right text-sm tabular-nums text-muted-foreground">
                          {row.createdAt ? (
                            <span className="inline-flex items-center justify-end gap-1">
                              <Calendar className="size-3.5 opacity-60" aria-hidden />
                              {new Date(row.createdAt).toLocaleDateString("de-CH")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="px-4 py-10 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                          <Users className="size-10 text-muted-foreground/50" aria-hidden />
                          <p className="text-sm font-medium text-foreground">Noch keine Mitarbeitenden</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Laden Sie über die rechte Karte die erste Person per E-Mail ein.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card
          size="sm"
          className="lg:sticky lg:top-20 lg:z-0 overflow-hidden border-border/60 shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
        >
          <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserPlus className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Einladung senden</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Einladungslink per E-Mail, Rolle wählbar.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <form action={inviteEmployeeAction} className="flex flex-col">
            <CardContent className="space-y-3 pt-4 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs font-medium">
                  E-Mail-Adresse
                </Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="name@firma.ch"
                  required
                  autoComplete="email"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs font-medium">
                  Rolle
                </Label>
                <InviteRoleSelect />
              </div>
              {turnstileConfigured ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Sicherheitsprüfung</span>
                  <div className="rounded-md border border-border/50 bg-muted/10 p-2.5">
                    <TurnstileField />
                  </div>
                </div>
              ) : (
                <TurnstileField />
              )}
              <p className="text-[11px] leading-snug text-muted-foreground text-pretty">
                Bestätigung durch den Empfänger über den Link in der Einladungsmail.
              </p>
            </CardContent>
            <CardFooter className="border-t border-border/50 bg-card px-4 py-3">
              <InviteEmployeeSubmitButton />
            </CardFooter>
          </form>
        </Card>
      </div>
    </section>
  );
}
