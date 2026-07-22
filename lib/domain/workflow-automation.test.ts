import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveInitialStatus,
  resolveNextStatusAfterAppointmentBooked,
  resolveRapportBehobenTarget,
  resolveSchedulingTargetStatus,
  resolveStatusAfterLastAppointmentDeleted,
} from "@/lib/domain/workflow-automation";

const STORENBAU_STAGES = [
  { key: "offen", isInitial: true, isSchedulingTarget: false, promotesOnAppointment: true, rapportBehobenTarget: false },
  { key: "bestellt", isInitial: false, isSchedulingTarget: false, promotesOnAppointment: true, rapportBehobenTarget: false },
  { key: "abgemacht", isInitial: false, isSchedulingTarget: true, promotesOnAppointment: false, rapportBehobenTarget: false },
  { key: "abrechnen", isInitial: false, isSchedulingTarget: false, promotesOnAppointment: false, rapportBehobenTarget: true },
  { key: "offerte_gesendet", isInitial: false, isSchedulingTarget: false, promotesOnAppointment: false, rapportBehobenTarget: false },
];

const MALER_STAGES = [
  { key: "anfrage", isInitial: true, isSchedulingTarget: false, promotesOnAppointment: true, rapportBehobenTarget: false },
  { key: "termin_fix", isInitial: false, isSchedulingTarget: true, promotesOnAppointment: false, rapportBehobenTarget: false },
  { key: "rechnung", isInitial: false, isSchedulingTarget: false, promotesOnAppointment: false, rapportBehobenTarget: true },
];

describe("resolveSchedulingTargetStatus", () => {
  it("fällt bei leerer Config auf den Fallback zurück", () => {
    assert.equal(resolveSchedulingTargetStatus([], "abgemacht"), "abgemacht");
  });
  it("liest den Zielstatus aus dem isSchedulingTarget-Tag", () => {
    assert.equal(resolveSchedulingTargetStatus(STORENBAU_STAGES, "abgemacht"), "abgemacht");
    assert.equal(resolveSchedulingTargetStatus(MALER_STAGES, "abgemacht"), "termin_fix");
  });
});

describe("resolveInitialStatus", () => {
  it("fällt bei leerer Config auf den Fallback zurück", () => {
    assert.equal(resolveInitialStatus([], "offen"), "offen");
  });
  it("liest den Start-Status aus dem isInitial-Tag", () => {
    assert.equal(resolveInitialStatus(STORENBAU_STAGES, "offen"), "offen");
    assert.equal(resolveInitialStatus(MALER_STAGES, "offen"), "anfrage");
  });
});

describe("resolveRapportBehobenTarget", () => {
  it("fällt bei leerer Config auf den Fallback zurück", () => {
    assert.equal(resolveRapportBehobenTarget([], "abrechnen"), "abrechnen");
  });
  it("liest den Zielstatus aus dem rapportBehobenTarget-Tag", () => {
    assert.equal(resolveRapportBehobenTarget(STORENBAU_STAGES, "abrechnen"), "abrechnen");
    assert.equal(resolveRapportBehobenTarget(MALER_STAGES, "abrechnen"), "rechnung");
  });
});

describe("resolveNextStatusAfterAppointmentBooked", () => {
  const fallbackList = ["offen", "bestellt"];

  it("rührt nichts an, wenn kein Termin bevorsteht", () => {
    assert.equal(resolveNextStatusAfterAppointmentBooked([], "offen", false, fallbackList), null);
  });

  it("promotet mit leerer Config exakt wie die alte hartcodierte Liste", () => {
    assert.equal(resolveNextStatusAfterAppointmentBooked([], "bestellt", true, fallbackList), "abgemacht");
    assert.equal(resolveNextStatusAfterAppointmentBooked([], "offerte_gesendet", true, fallbackList), null);
  });

  it("promotet mit Config über das promotesOnAppointment-Tag", () => {
    assert.equal(resolveNextStatusAfterAppointmentBooked(STORENBAU_STAGES, "bestellt", true, []), "abgemacht");
    assert.equal(resolveNextStatusAfterAppointmentBooked(STORENBAU_STAGES, "offerte_gesendet", true, []), null);
  });

  it("promotet bei einer anderen Org (Maler) auf deren eigenen Zielstatus", () => {
    assert.equal(resolveNextStatusAfterAppointmentBooked(MALER_STAGES, "anfrage", true, []), "termin_fix");
  });

  it("rührt nichts an, wenn Status schon der Zielstatus ist", () => {
    assert.equal(resolveNextStatusAfterAppointmentBooked(STORENBAU_STAGES, "abgemacht", true, []), null);
  });
});

describe("resolveStatusAfterLastAppointmentDeleted", () => {
  it("rührt nichts an, wenn der Status nicht der Terminbuchungs-Zielstatus ist (leere Config)", () => {
    assert.equal(resolveStatusAfterLastAppointmentDeleted([], "bestellt", null), null);
  });

  it("fällt mit leerer Config auf offen zurück, wenn kein Revert-Status gesetzt ist", () => {
    assert.equal(resolveStatusAfterLastAppointmentDeleted([], "abgemacht", null), "offen");
  });

  it("nutzt mit leerer Config den gesetzten Revert-Status", () => {
    assert.equal(resolveStatusAfterLastAppointmentDeleted([], "abgemacht", "bestellt"), "bestellt");
  });

  it("verhält sich mit Config identisch, nur mit den konfigurierten Status-Keys", () => {
    assert.equal(resolveStatusAfterLastAppointmentDeleted(STORENBAU_STAGES, "abgemacht", null), "offen");
    assert.equal(resolveStatusAfterLastAppointmentDeleted(STORENBAU_STAGES, "abgemacht", "bestellt"), "bestellt");
    assert.equal(resolveStatusAfterLastAppointmentDeleted(STORENBAU_STAGES, "bestellt", null), null);
  });

  it("funktioniert bei einer anderen Org (Maler) mit deren eigenen Status-Keys", () => {
    assert.equal(resolveStatusAfterLastAppointmentDeleted(MALER_STAGES, "termin_fix", null), "anfrage");
    assert.equal(resolveStatusAfterLastAppointmentDeleted(MALER_STAGES, "termin_fix", "anfrage"), "anfrage");
  });
});
