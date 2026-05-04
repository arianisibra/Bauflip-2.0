/**
 * Baut eine `tel:`-URL für `<a href>` – ohne Leerzeichen, damit Mobile-Geräte
 * zuverlässig den Anrufdialog anbieten.
 */
export function telHref(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const main = raw.split(";")[0]?.trim() ?? "";
  if (!main) return null;
  let s = main.replace(/[\s().-]/g, "");
  if (s.startsWith("00")) {
    s = `+${s.slice(2)}`;
  }
  if (s.startsWith("+")) {
    const rest = s.slice(1).replace(/\D/g, "");
    if (rest.length < 5) return null;
    return `tel:+${rest}`;
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length < 5) return null;
  return `tel:${digits}`;
}
