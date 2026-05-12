/** Eine Position pro Vorlage (z. B. Ersatzteile-Block). */
export function isSinglePositionOrderFormTemplate(tpl: { name: string; slug: string }): boolean {
  const name = tpl.name.toLowerCase();
  const slug = tpl.slug.toLowerCase();
  return name.includes("ersatzteile") || slug.includes("ersatzteile");
}
