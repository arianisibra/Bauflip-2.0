import type { Appointment, Project, ProjectAttachment, TechnicianReport, UserProfile } from "@/lib/domain/types";

export const mockProfiles: UserProfile[] = [
  {
    id: "u-office-1",
    displayName: "Büro Demo",
    email: "buero@bauflip.ch",
    role: "office",
    avatarUrl: null,
    calendarColor: "#0ea5e9",
    calendarPosition: 0,
  },
  {
    id: "u-tech-1",
    displayName: "Monteur Demo",
    email: "monteur@bauflip.ch",
    role: "technician",
    avatarUrl: null,
    calendarColor: "#22c55e",
    calendarPosition: 1,
  },
];

export const mockProjects: Project[] = [
  {
    id: "p-mock-1",
    organizationId: "mock-org",
    title: "Demo-Auftrag Sonnenschaden",
    type: "reparatur",
    status: "einsatz_offen",
    nextOwnerRole: "technician",
    nextOwnerUserId: "u-tech-1",
    source: "email",
    intakeOriginalText: "Beschädigung Storenbahn, Ersatz nötig.",
    accessNotes: "Schlüssel bei Verwaltung",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closedAt: null,
    referenceCode: `${new Date().getFullYear()}-1001`,
    hintsAndNotes: "Bitte Fotos von der Führungsschiene.",
    tenantName: "M. Muster",
    tenantPhone: "+41 79 000 00 00",
    tenantEmail: null,
    managementName: "Hausverwaltung XY",
    managementPhone: "+41 44 000 00 00",
    managementEmail: "info@verwaltung.ch",
    costCeilingText: "CHF 800",
    serviceStreet: "Musterstrasse 12",
    servicePostalCode: "8000",
    serviceCity: "Zürich",
    serviceCountry: "CH",
    statusUpdateSource: null,
    statusRevertOnAppointmentClear: null,
  },
];

export const mockAppointments: Appointment[] = [];
export const mockProjectAttachments: ProjectAttachment[] = [];
export const mockReports: TechnicianReport[] = [];
