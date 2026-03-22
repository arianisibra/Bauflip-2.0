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
  reference: string;
  message: string;
};

export async function generateSwissQrCodeDataUrl(input: SwissQrInput) {
  const payload = [
    "SPC",
    "0200",
    "1",
    input.iban,
    "K",
    input.creditorName,
    input.creditorStreet,
    "",
    input.creditorPostalCode,
    input.creditorCity,
    "CH",
    "",
    "",
    "",
    "",
    "",
    "",
    input.amount,
    input.currency,
    "K",
    input.debtorName,
    input.debtorStreet,
    "",
    input.debtorPostalCode,
    input.debtorCity,
    "CH",
    "QRR",
    input.reference,
    input.message,
    "EPD",
  ].join("\n");

  return QRCode.toDataURL(payload, { margin: 1, width: 280 });
}
