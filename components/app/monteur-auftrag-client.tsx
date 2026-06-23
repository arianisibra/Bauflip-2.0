"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProjectCore } from "@/lib/db/repository";
import type {
  OrderFormTemplate,
  ProjectAttachment,
  ProjectStatus,
  RapportNextStep,
  RoleType,
  TechnicianReport,
} from "@/lib/domain/types";
import { isSinglePositionOrderFormTemplate } from "@/lib/order-forms/template-utils";
import { getFilledOrderFormFields } from "@/lib/order-forms/filled-fields";
import { isMonteurMontageContext } from "@/lib/tech/monteur-context";
import { projectStatusBadgeClassName, projectStatusLabels } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/phone";
import { formatServiceAddress, managementLabel, tenantLabel } from "@/lib/tech/bundle-display";
import { fetchAuftragExtrasAction } from "@/app/(tech)/auftrag-data-actions";
import {
  useAuftragProjectCore,
  useDeleteAttachment,
  useSubmitTechnicianReport,
  useUpdateAttachmentNotes,
  useUpdateTechnicianReport,
  useUploadAttachment,
} from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { pickMonteurAppointmentDisplay } from "@/lib/tech/auftrag-appointments";
import { isLikelyProjectImage } from "@/lib/storage/mime";
import { TechMobileBackBar } from "@/components/app/tech-mobile-back-bar";
import { MonteurOrderFormSections } from "@/components/app/monteur-order-form-sections";
import { sanitizeTechReturnTo } from "@/lib/navigation/tech-field-navigation";
import { TechnicianReportEditOverlay } from "@/components/app/technician-report-edit-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BauflipLoadingButtonLabel, BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  ImagePlus,
  Loader2,
  Pencil,
  MapPin,
  Navigation,
  Paperclip,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  Wrench,
} from "lucide-react";

function buildMapsUrl(p: { serviceStreet: string | null; servicePostalCode: string | null; serviceCity: string | null }): string | null {
  const parts = [p.serviceStreet, p.servicePostalCode, p.serviceCity].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(", "))}`;
}

const TZ_CH = "Europe/Zurich";

function AppointmentRangeDisplay({
  startsAtIso,
  endsAtIso,
  className,
}: {
  startsAtIso: string;
  endsAtIso: string;
  className?: string;
}) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  const day = startsAt.toLocaleDateString("de-CH", { timeZone: TZ_CH });
  const startTime = startsAt.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_CH,
  });
  const endTime = endsAt.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_CH,
  });
  return (
    <span className={className}>
      {day}{" "}
      <span className="font-bold">{startTime}</span>
      {" – "}
      <span className="font-bold">{endTime}</span>
    </span>
  );
}

function AuftragSectionDivider() {
  return <div className="my-4 h-px w-full bg-border" aria-hidden />;
}

function orderFormsPayloadFromFormData(
  fd: FormData,
  templates: OrderFormTemplate[],
  lines: { templateId: string; lineId: string }[],
) {
  const byTpl = new Map(templates.map((t) => [t.id, t]));
  return lines
    .map(({ templateId, lineId }) => {
      const t = byTpl.get(templateId);
      if (!t) return null;
      const values: Record<string, string> = {};
      for (const f of t.fields) {
        values[f.key] = String(fd.get(`orderForm__${templateId}__${lineId}__${f.key}`) ?? "");
      }
      return { templateId, values };
    })
    .filter((x): x is { templateId: string; values: Record<string, string> } => x != null);
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

type NextStepOption = {
  value: RapportNextStep;
  label: string;
  description: string;
  icon: typeof Clock;
  toneClassName: string;
};

const RAPPORT_NEXT_STEP_OPTIONS_ERSTBESUCH: NextStepOption[] = [
  {
    value: "offerte_senden",
    label: "OFFERTE SENDEN",
    description: "Masse aufgenommen, Offerte erstellen",
    icon: ShoppingCart,
    toneClassName: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  },
  {
    value: "bestellen",
    label: "MATERIAL BESTELLEN",
    description: "Direkt bestellen, keine Offerte nötig",
    icon: ShoppingCart,
    toneClassName: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
  },
  {
    value: "montagebereit",
    label: "MONTAGEBEREIT",
    description: "Direkt zur Montage freigeben",
    icon: CheckCircle2,
    toneClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  },
  {
    value: "abholbereit",
    label: "WERKSTATT NÖTIG",
    description: "Gerät muss in die Werkstatt",
    icon: Truck,
    toneClassName: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-200",
  },
];

const RAPPORT_NEXT_STEP_OPTIONS_MONTAGE: NextStepOption[] = [
  {
    value: "einsatz_offen",
    label: "WEITERER TERMIN NÖTIG",
    description: "Montage nicht abgeschlossen, Büro plant neuen Termin",
    icon: Clock,
    toneClassName: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200",
  },
  {
    value: "montagebereit",
    label: "MONTAGEBEREIT",
    description: "Bereit für nächsten Montageeinsatz",
    icon: CheckCircle2,
    toneClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  },
  {
    value: "abholbereit",
    label: "WERKSTATT NÖTIG",
    description: "Gerät muss in die Werkstatt",
    icon: Truck,
    toneClassName: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-200",
  },
];

/** Kontext-Hilfen unter dem Status-Badge (Farben: projectStatusBadgeClassNames in types). */
const STATUS_CONFIG: Record<string, { description: string }> = {
  offen: { description: "" },
  abgemacht: {
    description: "Unten bei «Einsatz» Rapport ausfüllen oder Abschluss melden.",
  },
  einsatz_offen: { description: "Bestandesaufnahme oder Reparatur durchführen" },
  offerte_senden: { description: "Büro erstellt Offerte" },
  offerte_gesendet: { description: "Warte auf Kundenentscheid" },
  offerte_genehmigt: { description: "Offerte akzeptiert — Material bestellen" },
  bestellen: { description: "Büro bestellt Material" },
  bestellt: { description: "Material wurde bestellt — warte auf Lieferung" },
  montagebereit: { description: "Material eingetroffen — Montage ausführen" },
  abholbereit: { description: "Gerät bereit zur Abholung für Werkstatt" },
  werkstatt: { description: "Gerät in Werkstatt — Reparatur / Umbau" },
  abklaeren: { description: "Weitere Abklärungen ausstehend" },
  abrechnen: { description: "Arbeit abgeschlossen — Büro stellt Rechnung" },
  subunternehmer: { description: "Subunternehmer in Bearbeitung" },
  abgeschlossen: { description: "Auftrag vollständig abgeschlossen" },
};

function StatusBadge({ status }: { status: string }) {
  const label = projectStatusLabels[status as keyof typeof projectStatusLabels] ?? status;
  const cfg = STATUS_CONFIG[status];
  if (!cfg && !(status in projectStatusLabels)) {
    return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
  }
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px]", projectStatusBadgeClassName(status))}>
      {status === "abgeschlossen" ? <CheckCircle2 className="size-3" /> : null}
      {label}
    </Badge>
  );
}

function statusStandBannerVisible(status: string): boolean {
  const cfg = STATUS_CONFIG[status];
  return Boolean(cfg?.description);
}

function canEditMonteurPriorReport(
  r: TechnicianReport,
  viewerRole: RoleType,
  currentUserId: string,
): boolean {
  if (viewerRole === "office" || viewerRole === "admin") return true;
  if (viewerRole === "technician") return r.createdByProfileId === currentUserId;
  return false;
}

function MonteurPriorReportsSection({
  reports,
  viewerRole,
  currentUserId,
  onEditReport,
}: {
  reports: TechnicianReport[];
  viewerRole: RoleType;
  currentUserId: string;
  onEditReport: (r: TechnicianReport) => void;
}) {
  const sorted = useMemo(
    () => [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [reports],
  );
  if (sorted.length === 0) return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-sm">Frühere Rapporte und Bestellungen</CardTitle>
            <CardDescription className="text-xs">
              Vom Büro / vorherigem Einsatz — bitte mitnehmen, was hier bestellt oder vermerkt ist.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {sorted.map((r, idx) => {
          const isBehoben = r.outcome === "schaden_behoben";
          const created = new Date(r.createdAt);
          const createdDate = created.toLocaleDateString("de-CH", { timeZone: TZ_CH });
          const createdTime = created.toLocaleTimeString("de-CH", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: TZ_CH,
          });
          return (
            <details
              key={r.id}
              className="group rounded-lg border border-border/80 bg-muted/10 open:bg-card"
              open={idx === sorted.length - 1}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                    isBehoben
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {isBehoben ? <CheckCircle2 className="size-3.5" /> : <ClipboardList className="size-3.5" />}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">
                    {isBehoben ? "Behoben" : "Aufgenommen"}
                    {r.workDescription?.trim() ? (
                      <span className="ml-1.5 line-clamp-2 min-w-0 break-words font-normal text-muted-foreground">
                        — {r.workDescription.trim()}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.createdByDisplayName?.trim() ? (
                      <>Von {r.createdByDisplayName.trim()} · </>
                    ) : null}
                    {createdDate}{" "}
                    <span className="font-bold">{createdTime}</span>
                  </p>
                </div>
              </summary>
              <div className="space-y-3 border-t border-border/60 px-3 py-3 text-sm">
                {canEditMonteurPriorReport(r, viewerRole, currentUserId) ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => onEditReport(r)}
                    >
                      <Pencil className="size-3.5" />
                      Bearbeiten
                    </Button>
                  </div>
                ) : null}
                {r.workDescription?.trim() ? (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Arbeit / Material
                    </p>
                    <p className="whitespace-pre-wrap text-xs text-foreground">{r.workDescription}</p>
                  </div>
                ) : null}
                {r.orderForms.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Bestellformulare
                    </p>
                    {r.orderForms.map((of_, ofIdx) => {
                      const filledFields = getFilledOrderFormFields(of_);
                      if (filledFields.length === 0) return null;
                      const sameTplCount = r.orderForms.filter((x) => x.templateId === of_.templateId).length;
                      const positionInTpl =
                        r.orderForms.slice(0, ofIdx).filter((x) => x.templateId === of_.templateId).length + 1;
                      const positionLabel = sameTplCount > 1 ? ` · Position ${positionInTpl}` : "";
                      return (
                        <div
                          key={`${r.id}-${of_.templateId}-${ofIdx}`}
                          className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2"
                        >
                          <p className="text-xs font-semibold text-foreground">
                            {of_.templateName}
                            <span className="font-normal text-muted-foreground">{positionLabel}</span>
                          </p>
                          <dl className="mt-1.5 space-y-1">
                            {filledFields.map((f) => (
                              <div key={f.key} className="flex items-baseline gap-2 text-xs">
                                <dt className="shrink-0 text-muted-foreground">{f.label}:</dt>
                                <dd className="font-medium text-foreground">
                                  {of_.values[f.key]?.trim()}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StatusContextBanner({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg?.description) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stand: {projectStatusLabels[status as keyof typeof projectStatusLabels] ?? status}
        </p>
        <p className="mt-0.5 text-xs text-foreground">{cfg.description}</p>
      </div>
    </div>
  );
}

export function MonteurAuftragClient({
  core,
  skipOrderFormTemplates = false,
  viewerRole,
  currentUserId,
  returnTo = null,
}: {
  core: ProjectCore;
  skipOrderFormTemplates?: boolean;
  viewerRole: RoleType;
  currentUserId: string;
  returnTo?: string | null;
}) {
  const router = useRouter();
  const backHref = sanitizeTechReturnTo(returnTo);
  const { data: liveCore = core } = useAuftragProjectCore(core.project.id, core);
  const extrasQuery = useQuery({
    queryKey: queryKeys.auftragExtras(core.project.id, skipOrderFormTemplates),
    queryFn: () => fetchAuftragExtrasAction(core.project.id, skipOrderFormTemplates),
    staleTime: 90_000,
    refetchOnMount: false,
  });
  const orderFormTemplates = extrasQuery.data?.orderFormTemplates ?? [];
  const bundle = useMemo(() => {
    const extrasAtt = extrasQuery.data?.signedAttachments;
    if (!extrasAtt) return liveCore;
    const useLive =
      liveCore.attachments.length > extrasAtt.length ||
      (liveCore.attachments.length === extrasAtt.length &&
        liveCore.attachments.some((a) => a.signedUrl) &&
        !extrasAtt.some((a) => a.signedUrl));
    return {
      ...liveCore,
      attachments: useLive ? liveCore.attachments : extrasAtt,
    };
  }, [liveCore, extrasQuery.data?.signedAttachments]);
  const uploadAttachment = useUploadAttachment();
  const updateAttachmentNotes = useUpdateAttachmentNotes();
  const deleteAttachment = useDeleteAttachment();
  const submitReport = useSubmitTechnicianReport();
  const updateReport = useUpdateTechnicianReport();
  const p = bundle.project;
  const tenantTelHref = telHref(p.tenantPhone);

  // Montage-Kontext: Material bestellt / montagebereit / Nachtermin — kein neues Bestellformular.
  const isMontageContext = isMonteurMontageContext(p.status as ProjectStatus, bundle.reports.length);

  const nextStepOptions = isMontageContext
    ? RAPPORT_NEXT_STEP_OPTIONS_MONTAGE
    : RAPPORT_NEXT_STEP_OPTIONS_ERSTBESUCH;

  const [mode, setMode] = useState<"schaden_behoben" | "schaden_aufgenommen" | null>(null);
  const [nextStatus, setNextStatus] = useState<RapportNextStep | null>(null);
  const [orderFormLines, setOrderFormLines] = useState<{ templateId: string; lineId: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editReport, setEditReport] = useState<TechnicianReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Verhindert doppeltes Absenden (Doppeltipp / Race vor React-Re-Render). */
  const rapportSubmitLockRef = useRef(false);

  const imageAttachments = useMemo(
    () => bundle.attachments.filter((a) => isLikelyProjectImage(a.fileType, a.fileName)),
    [bundle.attachments],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      const fd = new FormData();
      fd.set("projectId", p.id);
      fd.set("file", file);
      try {
        const result = await uploadAttachment.mutateAsync({ formData: fd, projectId: p.id });
        if (!result.success) {
          toast.error(result.error);
        } else {
          toast.success("Datei hochgeladen");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload fehlgeschlagen.";
        setError(message);
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [p.id, uploadAttachment],
  );

  const saveNote = useCallback(
    async (attachmentId: string, notes: string) => {
      await updateAttachmentNotes.mutateAsync({ attachmentId, notes, projectId: p.id });
    },
    [p.id, updateAttachmentNotes],
  );

  const deletePhoto = useCallback(
    async (attachmentId: string, filePath: string) => {
      const result = await deleteAttachment.mutateAsync({ attachmentId, filePath, projectId: p.id });
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Datei gelöscht");
      }
    },
    [p.id, deleteAttachment],
  );

  const { displayAppt, furtherFuture, allPast } = useMemo(
    () => pickMonteurAppointmentDisplay(bundle.appointments),
    [bundle.appointments],
  );

  const showStandStep = statusStandBannerVisible(p.status);

  const toggleOrderFormTemplate = useCallback((templateId: string) => {
    setOrderFormLines((prev) => {
      const has = prev.some((l) => l.templateId === templateId);
      if (has) return prev.filter((l) => l.templateId !== templateId);
      return [...prev, { templateId, lineId: crypto.randomUUID() }];
    });
  }, []);

  const addOrderFormLine = useCallback((templateId: string) => {
    const tpl = orderFormTemplates.find((item) => item.id === templateId);
    const singlePositionOnly = tpl ? isSinglePositionOrderFormTemplate(tpl) : false;
    setOrderFormLines((prev) => {
      if (singlePositionOnly && prev.some((line) => line.templateId === templateId)) {
        return prev;
      }
      return [...prev, { templateId, lineId: crypto.randomUUID() }];
    });
  }, [orderFormTemplates]);

  const removeOrderFormLine = useCallback((lineId: string) => {
    setOrderFormLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  return (
    <section className="flex flex-col pb-8">
      <TechMobileBackBar returnTo={backHref} />
      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {p.referenceCode ? (
              <Badge variant="secondary" className="font-mono text-[11px]">
                {p.referenceCode}
              </Badge>
            ) : null}
            <StatusBadge status={p.status} />
          </div>
          <CardTitle className="mt-1 text-xl leading-tight">{p.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <InfoRow icon={MapPin} label="Adresse">
            {formatServiceAddress(p)}
          </InfoRow>
          {buildMapsUrl(p) ? (
            <button
              type="button"
              onClick={() => {
                window.open(buildMapsUrl(p)!, "_blank", "noopener,noreferrer");
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors active:scale-[0.98] hover:bg-primary/10"
            >
              <Navigation className="size-4" />
              Route starten
            </button>
          ) : null}
          <InfoRow icon={Clock} label={allPast && displayAppt ? "Letzter Termin" : "Nächster Termin"}>
            {displayAppt ? (
              <span className="block">
                <AppointmentRangeDisplay startsAtIso={displayAppt.startsAt} endsAtIso={displayAppt.endsAt} />
                {allPast ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                    Kein weiterer Termin geplant.
                  </span>
                ) : null}
              </span>
            ) : (
              "—"
            )}
          </InfoRow>
          {furtherFuture.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Weitere Termine</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {furtherFuture.map((a) => (
                  <li key={a.id}>
                    <AppointmentRangeDisplay startsAtIso={a.startsAt} endsAtIso={a.endsAt} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <InfoRow icon={User} label="Mieter">
            <span>{tenantLabel(p)}</span>
            {tenantTelHref && p.tenantPhone?.trim() ? (
              <a
                href={tenantTelHref}
                className="ml-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {p.tenantPhone.trim()}
              </a>
            ) : null}
          </InfoRow>
          <InfoRow icon={Building2} label="Verwaltung">
            {managementLabel(p)}
          </InfoRow>
          <InfoRow icon={Banknote} label="Kostendach">
            {p.costCeilingText?.trim() || "—"}
          </InfoRow>

        </CardContent>
      </Card>

      <AuftragSectionDivider />

      {showStandStep ? <StatusContextBanner status={p.status} /> : null}

      {showStandStep ? <AuftragSectionDivider /> : null}

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">Problem / Auftrag</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {p.intakeOriginalText}
          </p>
          {p.hintsAndNotes ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Hinweis Büro
                </p>
                <p className="mt-0.5 text-sm text-foreground">{p.hintsAndNotes}</p>
              </div>
            </div>
          ) : null}
          {bundle.attachments.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Anhänge ({bundle.attachments.length})
              </p>
              {extrasQuery.isPending ? (
                <BauflipLoadingInline label="Anhänge werden geladen …" />
              ) : null}
              {/* Image attachments as thumbnails */}
              {bundle.attachments.filter((a) => isLikelyProjectImage(a.fileType, a.fileName) && a.signedUrl).length >
                0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {bundle.attachments
                    .filter((a) => isLikelyProjectImage(a.fileType, a.fileName) && a.signedUrl)
                    .map((a) => (
                      <a
                        key={a.id}
                        href={a.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted active:scale-95"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.signedUrl} alt={a.fileName} className="size-full object-cover" />
                        {a.notes && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 backdrop-blur-sm">
                            <p className="line-clamp-1 text-[10px] text-white">{a.notes}</p>
                          </div>
                        )}
                      </a>
                    ))}
                </div>
              )}
              {/* Non-image attachments as links */}
              {bundle.attachments.filter((a) => !isLikelyProjectImage(a.fileType, a.fileName)).length > 0 && (
                <ul className="space-y-1.5">
                  {bundle.attachments
                    .filter((a) => !isLikelyProjectImage(a.fileType, a.fileName))
                    .map((a) => (
                      <li key={a.id}>
                        {a.signedUrl ? (
                          <a
                            href={a.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-primary transition-colors active:scale-[0.98] hover:bg-muted/50"
                          >
                            <Paperclip className="size-3.5 shrink-0" />
                            <span className="min-w-0 truncate">{a.fileName}</span>
                          </a>
                        ) : (
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Paperclip className="size-3 shrink-0" />
                            {a.fileName}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AuftragSectionDivider />

      {bundle.reports.length > 0 ? (
        <>
          <MonteurPriorReportsSection
            reports={bundle.reports}
            viewerRole={viewerRole}
            currentUserId={currentUserId}
            onEditReport={(r) => setEditReport(r)}
          />
          <AuftragSectionDivider />
        </>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isMontageContext ? "Montage" : "Einsatz"}
        </h2>
        <div className="grid gap-3 grid-cols-2">
          <button
            type="button"
            onClick={() => { setMode("schaden_behoben"); setNextStatus(null); }}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-center transition-all active:scale-[0.97] ${
              mode === "schaden_behoben"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <CheckCircle2
              className={`size-7 ${
                mode === "schaden_behoben" ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isMontageContext ? "Fertig" : "Behoben"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {isMontageContext ? "Montage abgeschlossen" : "Reparatur abgeschlossen"}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setMode("schaden_aufgenommen"); setNextStatus(null); }}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-center transition-all active:scale-[0.97] ${
              mode === "schaden_aufgenommen"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <ClipboardList
              className={`size-7 ${
                mode === "schaden_aufgenommen" ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isMontageContext ? "Nicht fertig" : "Aufgenommen"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {isMontageContext ? "Weiteres nötig, Büro entscheidet" : "Masse / Offerte folgt"}
              </p>
            </div>
          </button>
        </div>
      </section>

      {mode ? (
        <>
          <AuftragSectionDivider />
          <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="pt-4">
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const ne = e.nativeEvent as SubmitEvent;
                if ("submitter" in ne && ne.submitter === null) {
                  return;
                }
                if (
                  ne.submitter &&
                  (!(ne.submitter instanceof HTMLButtonElement) || ne.submitter.type !== "submit")
                ) {
                  return;
                }
                if (mode === "schaden_aufgenommen" && !nextStatus) {
                  setError("Bitte wähle den nächsten Schritt aus.");
                  return;
                }
                if (rapportSubmitLockRef.current) return;
                rapportSubmitLockRef.current = true;
                const fd = new FormData(e.currentTarget);
                setPending(true);
                setError(null);
                try {
                  const result = await submitReport.mutateAsync({
                    projectId: p.id,
                    outcome: mode,
                    nextStatus: mode === "schaden_aufgenommen" ? nextStatus ?? undefined : undefined,
                    summary: String(fd.get("reportNotes") ?? "").trim(),
                    measurementsJson: "{}",
                    workDescription: String(fd.get("reportNotes") ?? "").trim(),
                    orderForms: isMontageContext
                      ? []
                      : orderFormsPayloadFromFormData(fd, orderFormTemplates, orderFormLines),
                  });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Rapport gespeichert");
                  router.push(backHref ?? "/tag");
                } catch {
                  setError("Speichern fehlgeschlagen.");
                } finally {
                  rapportSubmitLockRef.current = false;
                  setPending(false);
                }
              }}
            >
              <input type="hidden" name="outcome" value={mode} />
              {!isMontageContext && orderFormTemplates.length > 0 ? (
                <MonteurOrderFormSections
                  templates={orderFormTemplates}
                  lines={orderFormLines}
                  onToggleTemplate={toggleOrderFormTemplate}
                  onAddLine={addOrderFormLine}
                  onRemoveLine={removeOrderFormLine}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="reportNotes" className="text-xs font-medium">
                  Rapport erfassen
                </Label>
                <Textarea
                  id="reportNotes"
                  name="reportNotes"
                  rows={6}
                  required
                  placeholder="Notizen zum Einsatz erfassen …"
                />
              </div>

              {/* Photo gallery + upload */}
              <div className="space-y-3">
                <Label className="text-xs font-medium">Fotos</Label>

                {imageAttachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {imageAttachments.map((a) => (
                      <AttachmentCard key={a.id} attachment={a} onSaveNote={saveNote} onDelete={deletePhoto} />
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:bg-muted/40 active:scale-[0.99] disabled:opacity-50"
                >
                  {uploading ? (
                    <BauflipLoadingButtonLabel>Wird hochgeladen…</BauflipLoadingButtonLabel>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Camera className="size-5" />
                        <ImagePlus className="size-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {imageAttachments.length > 0
                          ? "Weiteres Foto hinzufügen"
                          : "Foto aufnehmen oder auswählen"}
                      </p>
                    </>
                  )}
                </button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (!file) return;
                    await handleUpload(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
              </div>

              {mode === "schaden_aufgenommen" ? (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    NÄCHSTER SCHRITT
                  </h2>
                  <div className="grid gap-2 grid-cols-1">
                    {nextStepOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNextStatus(opt.value)}
                        className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all active:scale-[0.98] ${
                          nextStatus === opt.value
                            ? `${opt.toneClassName} ring-2 ring-primary/20`
                            : "border-border bg-card hover:bg-muted/30"
                        }`}
                      >
                        <opt.icon
                          className={`size-5 shrink-0 ${nextStatus === opt.value ? "" : "text-muted-foreground"}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-[11px] leading-snug text-muted-foreground">{opt.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Error */}
              {error ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              {/* Sticky submit */}
              <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md">
                <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
                  {pending ? (
                    <BauflipLoadingButtonLabel>Speichern…</BauflipLoadingButtonLabel>
                  ) : (
                    "Abschliessen"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </>
      ) : null}

      {editReport ? (
        <TechnicianReportEditOverlay
          key={editReport.id}
          report={editReport}
          projectId={p.id}
          templates={orderFormTemplates}
          onClose={() => setEditReport(null)}
          pending={updateReport.isPending}
          onSubmit={async (payload) => {
            try {
              await updateReport.mutateAsync(payload);
              toast.success("Rapport aktualisiert");
              setEditReport(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
            }
          }}
        />
      ) : null}
    </section>
  );
}

function AttachmentCard({
  attachment,
  onSaveNote,
  onDelete,
}: {
  attachment: ProjectAttachment;
  onSaveNote: (id: string, notes: string) => Promise<void>;
  onDelete: (id: string, filePath: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(attachment.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      await onSaveNote(attachment.id, value);
      setSaving(false);
    }, 800);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(attachment.id, attachment.filePath);
  };

  if (deleting) return null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {attachment.signedUrl ? (
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.signedUrl}
            alt={attachment.fileName}
            className="size-full object-cover"
          />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity active:scale-95"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative flex aspect-square items-center justify-center bg-muted/50">
          <Paperclip className="size-8 text-muted-foreground/40" />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity active:scale-95"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
      <div className="space-y-1 p-2">
        <p className="truncate text-[10px] text-muted-foreground">{attachment.fileName}</p>
        <textarea
          className="w-full resize-none rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          rows={2}
          placeholder="Notiz hinzufügen…"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
        />
        {saving ? (
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="size-3 shrink-0 animate-spin text-primary" aria-hidden />
            Speichert …
          </p>
        ) : null}
      </div>
    </div>
  );
}
