import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { listAssignableProfiles, listTimeTrackingEntriesInRange } from "@/lib/db/repository";
import { statusLabels } from "@/lib/workflow/project-workflow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock3, Filter, UserRound, Wrench } from "lucide-react";

type Props = {
  searchParams: Promise<{ from?: string; to?: string; technicianId?: string }>;
};

function toLocalDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInput(raw: string | undefined, fallback: Date) {
  if (!raw) {
    return fallback;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return fallback;
  }
  return d;
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function kindLabel(kind: "besichtigung" | "ausfuehrung") {
  return kind === "ausfuehrung" ? "Ausführung" : "Besichtigung";
}

export default async function ZeiterfassungPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  const sp = await searchParams;
  const now = new Date();
  const startDefault = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const fromDate = parseDateInput(sp.from, startDefault);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = parseDateInput(sp.to, endDefault);
  toDate.setHours(23, 59, 59, 999);

  const [profiles, entriesRaw] = await Promise.all([
    listAssignableProfiles(),
    listTimeTrackingEntriesInRange(fromDate, toDate),
  ]);

  const technicianFilter = String(sp.technicianId ?? "").trim();
  const entries = technicianFilter ? entriesRaw.filter((e) => e.technicianId === technicianFilter) : entriesRaw;

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const projectCount = new Set(entries.map((e) => e.projectId)).size;
  const employeeCount = new Set(entries.map((e) => e.technicianId ?? "none")).size;

  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = e.technicianId ?? "none";
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }
  const groupedRows = [...grouped.entries()]
    .map(([techId, items]) => ({
      techId,
      technicianName: items[0]?.technicianName ?? "Nicht zugewiesen",
      totalMinutes: items.reduce((sum, i) => sum + i.durationMinutes, 0),
      items,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const isAdmin = session?.role === "admin";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Zeiterfassung</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Admin-Ansicht: Einsatzzeiten sind mit Mitarbeiter und Projekt verknüpft und können pro Zeitraum ausgewertet
          werden.
        </p>
      </div>

      {!isAdmin ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="text-base">Kein Zugriff</CardTitle>
            <CardDescription>Diese Seite ist nur für Admins freigeschaltet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card size="sm" className="border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold tracking-tight">Filter</CardTitle>
              </div>
              <CardDescription className="text-xs">Zeitraum und optional Mitarbeiter auswählen.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form className="grid gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="from" className="text-xs font-medium">
                    Von
                  </Label>
                  <Input id="from" name="from" type="date" defaultValue={toLocalDateInput(fromDate)} className="h-9" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="to" className="text-xs font-medium">
                    Bis
                  </Label>
                  <Input id="to" name="to" type="date" defaultValue={toLocalDateInput(toDate)} className="h-9" />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="technicianId" className="text-xs font-medium">
                    Mitarbeiter
                  </Label>
                  <select
                    id="technicianId"
                    name="technicianId"
                    defaultValue={technicianFilter}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                  >
                    <option value="">Alle</option>
                    {profiles
                      .filter((p) => p.role === "technician")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <Button type="submit" size="sm">
                    Filter anwenden
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-2 sm:grid-cols-3">
            <Card size="sm" className="border-border/60 bg-muted/20 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardContent className="flex items-center gap-3 pt-3">
                <Clock3 className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Erfasste Zeit</p>
                  <p className="text-lg font-semibold tabular-nums">{formatMinutes(totalMinutes)}</p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm" className="border-border/60 bg-muted/20 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardContent className="flex items-center gap-3 pt-3">
                <Wrench className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Projekte</p>
                  <p className="text-lg font-semibold tabular-nums">{projectCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm" className="border-border/60 bg-muted/20 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardContent className="flex items-center gap-3 pt-3">
                <UserRound className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Mitarbeiter</p>
                  <p className="text-lg font-semibold tabular-nums">{employeeCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {groupedRows.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardHeader>
                <CardTitle className="text-base">Keine Zeiteinträge im gewählten Zeitraum</CardTitle>
                <CardDescription>
                  Passen Sie den Zeitraum an oder erfassen Sie neue Termine mit Mitarbeiter-Zuweisung.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {groupedRows.map((group) => (
                <Card key={group.techId} size="sm" className="border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
                  <CardHeader className="border-b border-border/50 bg-muted/15 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold tracking-tight">{group.technicianName}</CardTitle>
                      <Badge variant="outline" className="font-medium">
                        {formatMinutes(group.totalMinutes)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-3">
                    {group.items.map((entry) => (
                      <div
                        key={entry.appointmentId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{entry.projectTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("de-CH", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(entry.startsAt))}
                            {" · "}
                            {kindLabel(entry.kind)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{statusLabels[entry.projectStatus]}</Badge>
                          <Badge variant="outline" className="tabular-nums font-medium">
                            {formatMinutes(entry.durationMinutes)}
                          </Badge>
                          <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/projekte/${entry.projectId}`} />}>
                            Projekt
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
