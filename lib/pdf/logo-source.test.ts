import assert from "node:assert/strict";
import { test } from "node:test";
import { istErlaubteLogoQuelle } from "@/lib/pdf/logo-source";

const PROJEKT = "https://abcdefgh.supabase.co";
const ERLAUBT = `${PROJEKT}/storage/v1/object/public/avatars/organizations/x/logo.png`;

function mitBasis<T>(basis: string | undefined, fn: () => T): T {
  const vorher = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (basis === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = basis;
  try {
    return fn();
  } finally {
    if (vorher === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = vorher;
  }
}

test("eigenes Storage-Objekt ist erlaubt", () => {
  mitBasis(PROJEKT, () => {
    assert.equal(istErlaubteLogoQuelle(ERLAUBT), true);
  });
});

test("Basis mit abschliessendem Schrägstrich stört nicht", () => {
  mitBasis(`${PROJEKT}/`, () => {
    assert.equal(istErlaubteLogoQuelle(ERLAUBT), true);
  });
});

test("interne Adressen werden abgewiesen (SSRF)", () => {
  mitBasis(PROJEKT, () => {
    // Cloud-Metadatendienst — das klassische Ziel.
    assert.equal(istErlaubteLogoQuelle("http://169.254.169.254/latest/meta-data/"), false);
    assert.equal(istErlaubteLogoQuelle("http://127.0.0.1:3000/intern"), false);
    assert.equal(istErlaubteLogoQuelle("http://localhost:54321/x"), false);
    assert.equal(istErlaubteLogoQuelle("http://10.0.0.5/x"), false);
  });
});

test("fremde Hosts werden abgewiesen — auch mit passendem Pfad", () => {
  mitBasis(PROJEKT, () => {
    assert.equal(
      istErlaubteLogoQuelle("https://evil.com/storage/v1/object/public/avatars/x.png"),
      false,
    );
    // Ähnlich aussehender Host reicht nicht.
    assert.equal(
      istErlaubteLogoQuelle("https://abcdefgh.supabase.co.evil.com/storage/v1/object/public/x.png"),
      false,
    );
  });
});

test("richtiger Host, aber fremder Pfad wird abgewiesen", () => {
  mitBasis(PROJEKT, () => {
    assert.equal(istErlaubteLogoQuelle(`${PROJEKT}/rest/v1/organizations`), false);
    assert.equal(istErlaubteLogoQuelle(`${PROJEKT}/auth/v1/token`), false);
  });
});

test("anderes Schema oder anderer Port zaehlt als fremder Ursprung", () => {
  mitBasis(PROJEKT, () => {
    assert.equal(
      istErlaubteLogoQuelle("http://abcdefgh.supabase.co/storage/v1/object/public/x.png"),
      false,
    );
    assert.equal(
      istErlaubteLogoQuelle("https://abcdefgh.supabase.co:8443/storage/v1/object/public/x.png"),
      false,
    );
  });
});

test("ohne konfigurierte Basis wird nichts erlaubt", () => {
  mitBasis(undefined, () => {
    assert.equal(istErlaubteLogoQuelle(ERLAUBT), false);
  });
});

test("Unsinn statt URL wird abgewiesen", () => {
  mitBasis(PROJEKT, () => {
    assert.equal(istErlaubteLogoQuelle("kein-url"), false);
    assert.equal(istErlaubteLogoQuelle(""), false);
    assert.equal(istErlaubteLogoQuelle("javascript:alert(1)"), false);
  });
});
