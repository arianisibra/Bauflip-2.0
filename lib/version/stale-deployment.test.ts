import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Der Store hält Modulzustand (einmal veraltet, immer veraltet). Für jeden Fall
 * braucht es deshalb eine frische Instanz — die Query im Importpfad erzwingt sie.
 */
async function freshModule(ownId: string, instance: string) {
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID = ownId;
  return import(`./stale-deployment.ts?case=${instance}`);
}

function stubFetch(handler: () => Promise<Response> | Response): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => handler()) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("gleiche Deployment-Kennung gilt nicht als veraltet", async () => {
  const mod = await freshModule("build-a", "same");
  const restore = stubFetch(() => jsonResponse({ deploymentId: "build-a" }));
  try {
    await mod.checkDeploymentVersion();
    assert.equal(mod.getStaleDeploymentSnapshot(), false);
  } finally {
    restore();
  }
});

test("abweichende Kennung markiert den Tab als veraltet und meldet es", async () => {
  const mod = await freshModule("build-a", "diff");
  const restore = stubFetch(() => jsonResponse({ deploymentId: "build-b" }));
  let notified = 0;
  const unsubscribe = mod.subscribeStaleDeployment(() => {
    notified += 1;
  });
  try {
    await mod.checkDeploymentVersion();
    assert.equal(mod.getStaleDeploymentSnapshot(), true);
    assert.equal(notified, 1);
  } finally {
    unsubscribe();
    restore();
  }
});

test("Netzwerkfehler löst keinen Hinweis aus — Funkloch ist kein Deploy", async () => {
  const mod = await freshModule("build-a", "offline");
  const restore = stubFetch(() => {
    throw new Error("offline");
  });
  try {
    await mod.checkDeploymentVersion();
    assert.equal(mod.getStaleDeploymentSnapshot(), false);
  } finally {
    restore();
  }
});

test("Fehlerantwort des Servers löst keinen Hinweis aus", async () => {
  const mod = await freshModule("build-a", "http-500");
  const restore = stubFetch(() => new Response("nope", { status: 500 }));
  try {
    await mod.checkDeploymentVersion();
    assert.equal(mod.getStaleDeploymentSnapshot(), false);
  } finally {
    restore();
  }
});

test("einmal veraltet bleibt veraltet und fragt nicht weiter nach", async () => {
  const mod = await freshModule("build-a", "latch");
  let calls = 0;
  const restore = stubFetch(() => {
    calls += 1;
    return jsonResponse({ deploymentId: "build-b" });
  });
  try {
    await mod.checkDeploymentVersion();
    assert.equal(mod.getStaleDeploymentSnapshot(), true);
    assert.equal(calls, 1);

    // Selbst wenn der Server danach wieder die alte Kennung meldet: Der geladene
    // Tab wird dadurch nicht jünger.
    await mod.checkDeploymentVersion();
    assert.equal(mod.getStaleDeploymentSnapshot(), true);
    assert.equal(calls, 1, "keine weitere Abfrage nach erkanntem Versatz");
  } finally {
    restore();
  }
});

test("ohne eigene Kennung wird nicht geprüft", async () => {
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID = "";
  const mod = await import("./stale-deployment.ts?case=no-id");
  let calls = 0;
  const restore = stubFetch(() => {
    calls += 1;
    return jsonResponse({ deploymentId: "build-b" });
  });
  try {
    await mod.checkDeploymentVersion();
    assert.equal(calls, 0);
    assert.equal(mod.getStaleDeploymentSnapshot(), false);
  } finally {
    restore();
  }
});
