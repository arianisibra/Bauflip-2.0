import QRCode from "qrcode";

type SwissQrInput = {
  iban: string;
  creditorName: string;
  creditorStreet: string;
  creditorPostalCode: string;
  creditorCity: string;
  amount: string;
  currency: "CHF" | "EUR";
  debtorName: string;
  debtorStreet: string;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry?: string;
  reference: string;
  message: string;
};

function normalizeAmount(raw: string): string {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) {
    return "0.00";
  }
  return n.toFixed(2);
}

function normalizeReference(raw: string): { refType: "QRR" | "SCOR" | "NON"; refValue: string } {
  const value = String(raw ?? "").trim();
  const digitsOnly = value.replace(/\s+/g, "");
  if (/^\d{27}$/.test(digitsOnly)) {
    return { refType: "QRR", refValue: digitsOnly };
  }
  const scor = value.replace(/\s+/g, "").toUpperCase();
  if (/^RF[0-9A-Z]{2,23}$/.test(scor)) {
    return { refType: "SCOR", refValue: scor };
  }
  // Fallback for non-standard internal references like "RE-2026-001".
  return { refType: "NON", refValue: "" };
}

function normalizeIban(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

function isValidChLiIban(iban: string): boolean {
  return /^(CH|LI)[0-9]{2}[A-Z0-9]{17}$/.test(iban);
}

function isQrIban(iban: string): boolean {
  if (!isValidChLiIban(iban)) {
    return false;
  }
  const iid = Number(iban.slice(4, 9));
  return Number.isFinite(iid) && iid >= 30000 && iid <= 31999;
}

function splitStreet(streetLine: string): { street: string; houseNo: string } {
  const value = String(streetLine ?? "").trim();
  const m = value.match(/^(.*?)[,\s]+(\d+[A-Za-z0-9/-]*)$/);
  if (!m) {
    return { street: value, houseNo: "" };
  }
  return { street: String(m[1] ?? "").trim(), houseNo: String(m[2] ?? "").trim() };
}

function assertPayloadRules(input: {
  iban: string;
  currency: "CHF" | "EUR";
  amount: string;
  referenceType: "QRR" | "SCOR" | "NON";
  reference: string;
  creditorName: string;
  creditorPostalCode: string;
  creditorCity: string;
  debtorName: string;
  debtorPostalCode: string;
  debtorCity: string;
}) {
  if (!isValidChLiIban(input.iban)) {
    throw new Error("IBAN muss CH/LI sein und ohne Leerzeichen übertragen werden.");
  }
  if (!/^\d{1,9}\.\d{2}$/.test(input.amount)) {
    throw new Error("Betrag muss im Format 123.45 vorliegen.");
  }
  const amountN = Number(input.amount);
  if (!(amountN >= 0.01 && amountN <= 999999999.99)) {
    throw new Error("Betrag muss zwischen 0.01 und 999999999.99 liegen.");
  }
  if (!input.creditorName || !input.creditorPostalCode || !input.creditorCity) {
    throw new Error("Gläubigerdaten sind unvollständig (Name, PLZ, Ort).");
  }
  if (!input.debtorName || !input.debtorPostalCode || !input.debtorCity) {
    throw new Error("Schuldnerdaten sind unvollständig (Name, PLZ, Ort).");
  }
  const qrIban = isQrIban(input.iban);
  if (qrIban && input.referenceType !== "QRR") {
    throw new Error("Bei QR-IBAN muss Referenztyp QRR mit 27-stelliger QR-Referenz verwendet werden.");
  }
  if (!qrIban && input.referenceType === "QRR") {
    throw new Error("QRR ist nur mit QR-IBAN zulässig.");
  }
  if (input.referenceType === "QRR") {
    if (!/^\d{27}$/.test(input.reference)) {
      throw new Error("QR-Referenz (QRR) muss genau 27 numerische Zeichen haben.");
    }
    if (input.currency !== "CHF") {
      throw new Error("QRR ist nur mit CHF zulässig.");
    }
  }
  if (input.referenceType === "SCOR") {
    if (!/^RF[0-9A-Z]{2,23}$/.test(input.reference)) {
      throw new Error("SCOR muss mit RF beginnen und 5-25 alphanumerische Zeichen enthalten.");
    }
  }
  if (input.referenceType === "NON" && input.reference !== "") {
    throw new Error("Bei NON darf keine Referenz übergeben werden.");
  }
}

export async function generateSwissQrCodeDataUrl(input: SwissQrInput) {
  const iban = normalizeIban(input.iban);
  const amount = normalizeAmount(input.amount);
  const { refType, refValue } = normalizeReference(input.reference);
  const creditorAddress = splitStreet(input.creditorStreet);
  const debtorAddress = splitStreet(input.debtorStreet);
  const debtorCountry = String(input.debtorCountry ?? "CH").toUpperCase();

  assertPayloadRules({
    iban,
    currency: input.currency,
    amount,
    referenceType: refType,
    reference: refValue,
    creditorName: String(input.creditorName ?? "").trim(),
    creditorPostalCode: String(input.creditorPostalCode ?? "").trim(),
    creditorCity: String(input.creditorCity ?? "").trim(),
    debtorName: String(input.debtorName ?? "").trim(),
    debtorPostalCode: String(input.debtorPostalCode ?? "").trim(),
    debtorCity: String(input.debtorCity ?? "").trim(),
  });

  const payload = [
    "SPC",
    "0200",
    "1",
    iban,
    "S",
    String(input.creditorName ?? "").trim(),
    creditorAddress.street,
    creditorAddress.houseNo,
    String(input.creditorPostalCode ?? "").trim(),
    String(input.creditorCity ?? "").trim(),
    "CH",
    "",
    "",
    "",
    "",
    "",
    "",
    amount,
    input.currency,
    "S",
    String(input.debtorName ?? "").trim(),
    debtorAddress.street,
    debtorAddress.houseNo,
    String(input.debtorPostalCode ?? "").trim(),
    String(input.debtorCity ?? "").trim(),
    /^[A-Z]{2}$/.test(debtorCountry) ? debtorCountry : "CH",
    refType,
    refValue,
    String(input.message ?? "").trim().slice(0, 140),
    "EPD",
  ].join("\r\n");

  return QRCode.toDataURL(payload, { margin: 1, width: 280, errorCorrectionLevel: "M" });
}
