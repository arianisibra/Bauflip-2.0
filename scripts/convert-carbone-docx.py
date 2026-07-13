#!/usr/bin/env python3
"""
Konvertiert eine Kunden-Offertvorlage (Word .docx im Carbone-Format, `{d.Feld}`,
`[i]`/`[i+1]`-Positionsschleife, `:formatter`) in eine docxtemplater-Vorlage mit
den kanonischen Bauflip-Feldnamen aus lib/documents/quote-document-data.ts.

Onboarding-Werkzeug (kein Laufzeit-Code): pro Kundenvorlage einmal ausführen, dann
das Ergebnis in Word gegenprüfen und als Org-Vorlage speichern.

    python3 scripts/convert-carbone-docx.py EINGABE.docx AUSGABE.docx

Warum die 4 Schritte nötig sind (im Code dokumentiert):
1. Word zerreisst Platzhalter über viele Runs -> gleich formatierte Runs zusammenführen.
2. Carbone-Formatter (`:html.convCLRF` …) entfernen — docxtemplater kennt sie nicht.
3. Positionsschleife `{d.X[i].Feld}`/`[i+1]` -> `{#positionen}{feld}…{/positionen}`.
4. `{d.Feldname}` -> `{kanonischer_name}` (flach; docxtemplaters Default-Parser löst
   verschachtelte `d.x` nicht auf).
"""
import re
import sys
import zipfile
import shutil
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
ET.register_namespace("w", W)


def q(tag: str) -> str:
    return f"{{{W}}}{tag}"


# Kunden-Feldname (Carbone) -> kanonischer Bauflip-Name (siehe quote-document-data.ts).
FIELD_MAP = {
    "Angebotsnummer": "offerte_nummer",
    "Titel": "projekt_titel",
    "Angebotsdatum": "datum",
    "Gültigkeit_in_Tagen": "gueltig_bis",
    "Mitarbeiter": "ansprechpartner",
    "Kundennummer": "kundennummer",
    "Referenz": "referenz",
    "Lieferfrist": "lieferfrist",
    "Eigentümer": "eigentuemer",
    "Objekt": "objekt",
    "Briefanrede": "briefanrede",
    "KopftextStyle": "kopftext",
    "FusstextStyle": "fusstext",
    "AdressenAdresse": "objekt_strasse",
    "AdressenPLZ": "objekt_plz_ort",
    "Druck1": "kunde_name",
    "Druck2": "verwaltung_name",
    "Druck3": "kunde_zusatz",
    "Summe-Netto": "total_netto",
    "Total": "total_netto",
    "MwSt": "mwst_satz",
    "Mehrwertsteuer": "mwst_betrag",
    "Gesamtbetrag": "total_brutto",
    "Text-Rabatt": "rabatt_text",
    "Rabatt": "rabatt",
    "Text-Rabatt-Betrag": "rabatt_betrag",
}
# Positions-Loopfelder (relativ, innerhalb {#positionen}…{/positionen}).
POSITION_MAP = {
    "Position": "pos",
    "Beschreibung": "beschreibung",
    "MengeEinheit": "menge_einheit",
    "Einzelpreis": "einzelpreis",
    "Gesamtpreis_netto": "zeilentotal",
}


def _rpr_bytes(run):
    rpr = run.find(q("rPr"))
    return ET.tostring(rpr) if rpr is not None else b""


def _is_simple_text_run(run):
    ts = run.findall(q("t"))
    others = [c for c in run if c.tag not in (q("rPr"), q("t"))]
    return len(ts) == 1 and not others


def _strip_proof(parent):
    for c in list(parent):
        if c.tag == q("proofErr"):
            parent.remove(c)
        else:
            _strip_proof(c)


def _merge_runs(parent):
    """Aufeinanderfolgende einfache Text-Runs zusammenführen, sodass Platzhalter
    zusammenhängend werden: bei identischem rPr, ODER wenn der linke Run auf `{`
    endet (Platzhalter-Opener werden von Word oft in einen eigenen Run isoliert)."""
    new, prev, prevkey = [], None, None
    for c in list(parent):
        if c.tag == q("r") and _is_simple_text_run(c):
            key = _rpr_bytes(c)
            prev_text = (prev.find(q("t")).text or "") if prev is not None else ""
            if prev is not None and (key == prevkey or prev_text.endswith("{")):
                pt, ct = prev.find(q("t")), c.find(q("t"))
                pt.text = (pt.text or "") + (ct.text or "")
                pt.set(XML_SPACE, "preserve")
                continue
            new.append(c)
            prev, prevkey = c, key
        else:
            new.append(c)
            prev, prevkey = None, None
            _merge_runs(c)
    for c in list(parent):
        parent.remove(c)
    for c in new:
        parent.append(c)


def convert_document_xml(xml: str) -> str:
    # 2) Carbone-Formatter entfernen: {d.Feld:...} -> {d.Feld}
    xml = re.sub(r"(\{d\.[A-Za-zÄÖÜäöü0-9_\-]+):[^}]*\}", r"\1}", xml)

    # 3) Positionsschleife umbauen
    xml = xml.replace("{d.Angebotspositionen[i].Position}", "{#positionen}{pos}")
    for src, dst in POSITION_MAP.items():
        if dst == "pos":
            continue
        marker = "{/positionen}" if dst == "zeilentotal" else ""
        xml = xml.replace(f"{{d.Angebotspositionen[i].{src}}}", f"{{{dst}}}{marker}")
    # Zweitzeile ([i+1]) der Schleife ganz entfernen
    xml = re.sub(
        r"<w:tr\b(?:(?!</w:tr>).)*?Angebotspositionen\[i\+1\](?:(?!</w:tr>).)*?</w:tr>",
        "", xml, flags=re.S,
    )

    # 4) Kopf-/Fussfelder auf kanonische Namen mappen + flach machen.
    #    Funktioniert für zusammenhängende `{d.Feld}` UND von Word gespaltene
    #    `{`|`d.Feld}`-Tokens: der Teilstring `d.Feld}` steht in beiden Fällen
    #    zusammenhängend in einem Text-Run, das schliessende `}` grenzt sauber ab
    #    (kein Teiltreffer zwischen z. B. Rabatt und Text-Rabatt-Betrag).
    for src, dst in FIELD_MAP.items():
        xml = xml.replace(f"d.{src}}}", f"{dst}}}")
    return xml


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    shutil.copyfile(src, dst)

    with zipfile.ZipFile(src) as z:
        doc = z.read("word/document.xml")

    # 1) Normalisieren (proofErr weg, gleich formatierte Runs mergen)
    root = ET.fromstring(doc)
    _strip_proof(root)
    _merge_runs(root)
    normalized = ET.tostring(root, encoding="unicode")

    converted = convert_document_xml(normalized)
    if not converted.lstrip().startswith("<?xml"):
        converted = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + converted

    # Nicht gemappte {d.…}-Orphans (Felder ohne Bauflip-Entsprechung, z. B. Positions-
    # Rabatt) leeren, damit die Vorlage keine kaputten Platzhalter enthält. Die Warnung
    # bleibt, damit man beim Onboarding sieht, was weggefallen ist.
    leftover = re.findall(r"\{d\.[^}]*\}", converted)
    converted = re.sub(r"\{d\.[^}]*\}", "", converted)

    # document.xml im Ziel-Zip ersetzen
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.namelist():
            data = converted.encode("utf-8") if item == "word/document.xml" else zin.read(item)
            zout.writestr(item, data)

    print(f"OK: {dst} erstellt.")
    if leftover:
        print(f"  Hinweis: {len(leftover)} Feld(er) ohne Bauflip-Entsprechung geleert: {leftover[:8]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
