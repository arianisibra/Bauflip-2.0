import type {
  Appointment,
  Customer,
  Delivery,
  Invoice,
  Project,
  ProjectNote,
  PurchaseOrder,
  Quote,
  TechnicianReport,
} from "@/lib/domain/types";

const now = new Date().toISOString();

export const mockCustomers: Customer[] = [
  {
    id: "c-1",
    name: "Müller AG",
    email: "info@mueller-ag.ch",
    phone: "+41 44 555 10 10",
    street: "Bahnhofstrasse 8",
    postalCode: "8001",
    city: "Zürich",
    createdAt: now,
  },
];

export const mockProjects: Project[] = [
  {
    id: "p-1",
    customerId: "c-1",
    title: "Lamellenstoren Westfassade",
    type: "reparatur",
    status: "bericht_ausstehend",
    nextOwnerRole: "technician",
    nextOwnerUserId: null,
    source: "telefon",
    urgency: "hoch",
    intakeOriginalText:
      "Kunde meldet: Lamellenstoren blockiert seit gestern, lautes Geräusch beim Hochfahren.",
    accessNotes: "Zugang über Seiteneingang links, Klingel Werkstatt.",
    keyHandlingNotes: "Schlüssel bei Nachbarin Frau Keller, Wohnung 2.",
    timingNotes: "Nur zwischen 07:30 und 11:30 Uhr möglich.",
    internalNotes: "Bitte zuerst Motor prüfen, Kunde braucht schnelle Lösung.",
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  },
];

export const mockNotes: ProjectNote[] = [
  {
    id: "n-1",
    projectId: "p-1",
    type: "kunde",
    body: "Originalmeldung telefonisch aufgenommen, Geräusch beim Hochfahren.",
    authorRole: "office",
    createdAt: now,
  },
  {
    id: "n-2",
    projectId: "p-1",
    type: "planung",
    body: "Ersttermin geplant für Montag 08:30.",
    authorRole: "office",
    createdAt: now,
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: "a-1",
    projectId: "p-1",
    kind: "besichtigung",
    startsAt: now,
    endsAt: now,
    assignedTechnicianId: null,
    planningNotes: "Bitte Leiter und Messgerät mitnehmen.",
    accessNotes: "Seiteneingang.",
    keyHandlingNotes: "Schlüssel bei Nachbarin.",
    createdAt: now,
  },
];

export const mockReports: TechnicianReport[] = [];
export const mockQuotes: Quote[] = [];
export const mockOrders: PurchaseOrder[] = [];
export const mockDeliveries: Delivery[] = [];
export const mockInvoices: Invoice[] = [];
