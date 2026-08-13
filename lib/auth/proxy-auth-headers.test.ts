import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROXY_AUTH_ORG_ID_HEADER,
  PROXY_AUTH_ROLE_HEADER,
  PROXY_AUTH_USER_ID_HEADER,
  applyProxyAuthContext,
  readProxyAuthOrgId,
  readProxyAuthRole,
  readProxyAuthUserId,
  stripProxyAuthContext,
} from "@/lib/auth/proxy-auth-headers";

/**
 * Diese Header sind das interne Signal des Proxys an die App. Käme eines von
 * aussen durch, könnte ein Fremder sich Rolle und Organisation frei aussuchen
 * und damit jede Rollenprüfung und jeden Service-Role-Pfad übernehmen.
 *
 * Der Proxy verwirft eingehende Exemplare deshalb bedingungslos als Erstes.
 * Diese Tests halten genau diese Invariante fest.
 */

test("stripProxyAuthContext entfernt alle drei Header", () => {
  const headers = new Headers({
    [PROXY_AUTH_USER_ID_HEADER]: "00000000-0000-0000-0000-000000000001",
    [PROXY_AUTH_ROLE_HEADER]: "admin",
    [PROXY_AUTH_ORG_ID_HEADER]: "14dff19e-7c28-420d-9af4-e8e08114c167",
    "x-harmlos": "bleibt",
  });

  stripProxyAuthContext(headers);

  assert.equal(readProxyAuthUserId(headers), null);
  assert.equal(readProxyAuthRole(headers), null);
  assert.equal(readProxyAuthOrgId(headers), null);
  // Fremde Header dürfen dabei nicht verloren gehen.
  assert.equal(headers.get("x-harmlos"), "bleibt");
});

test("stripProxyAuthContext ist auch ohne vorhandene Header unbedenklich", () => {
  const headers = new Headers({ "content-type": "application/json" });
  stripProxyAuthContext(headers);
  assert.equal(readProxyAuthUserId(headers), null);
  assert.equal(headers.get("content-type"), "application/json");
});

test("gefälschte Header überleben Verwerfen und anschliessendes Setzen nicht", () => {
  // Genau die Reihenfolge im Proxy: erst verwerfen, dann den echten Kontext setzen.
  const headers = new Headers({
    [PROXY_AUTH_USER_ID_HEADER]: "gefaelschte-uuid",
    [PROXY_AUTH_ROLE_HEADER]: "admin",
    [PROXY_AUTH_ORG_ID_HEADER]: "fremde-org",
  });

  stripProxyAuthContext(headers);
  applyProxyAuthContext(headers, {
    userId: "echte-uuid",
    role: "technician",
    organizationId: "eigene-org",
  });

  assert.equal(readProxyAuthUserId(headers), "echte-uuid");
  assert.equal(readProxyAuthRole(headers), "technician");
  assert.equal(readProxyAuthOrgId(headers), "eigene-org");
});

test("ohne Organisation bleibt kein alter Org-Header stehen", () => {
  // Sonst erbte ein Nutzer ohne Organisation die mitgeschickte fremde Org.
  const headers = new Headers({ [PROXY_AUTH_ORG_ID_HEADER]: "fremde-org" });

  stripProxyAuthContext(headers);
  applyProxyAuthContext(headers, {
    userId: "echte-uuid",
    role: "office",
    organizationId: null,
  });

  assert.equal(readProxyAuthOrgId(headers), null);
});
