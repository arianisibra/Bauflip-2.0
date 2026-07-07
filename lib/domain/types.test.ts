import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSetQuoteStatus, nextProjectStatusAfterAppointmentBooked } from "@/lib/domain/types";

describe("nextProjectStatusAfterAppointmentBooked", () => {
  it("promotes bestellt to abgemacht when appointment is upcoming", () => {
    assert.equal(
      nextProjectStatusAfterAppointmentBooked("bestellt", { appointmentIsUpcoming: true }),
      "abgemacht",
    );
  });

  it("promotes offen to abgemacht when appointment is upcoming", () => {
    assert.equal(
      nextProjectStatusAfterAppointmentBooked("offen", { appointmentIsUpcoming: true }),
      "abgemacht",
    );
  });

  it("leaves status unchanged when appointment is not upcoming", () => {
    assert.equal(
      nextProjectStatusAfterAppointmentBooked("bestellt", { appointmentIsUpcoming: false }),
      null,
    );
  });

  it("does not promote abrechnen even with upcoming appointment", () => {
    assert.equal(
      nextProjectStatusAfterAppointmentBooked("abrechnen", { appointmentIsUpcoming: true }),
      null,
    );
  });

  it("does not promote abgemacht again", () => {
    assert.equal(
      nextProjectStatusAfterAppointmentBooked("abgemacht", { appointmentIsUpcoming: true }),
      null,
    );
  });
});

describe("canSetQuoteStatus", () => {
  it("allows draft to sent", () => {
    assert.equal(canSetQuoteStatus("draft", "sent"), true);
  });

  it("allows sent to approved and rejected", () => {
    assert.equal(canSetQuoteStatus("sent", "approved"), true);
    assert.equal(canSetQuoteStatus("sent", "rejected"), true);
  });

  it("allows rejected back to draft for rework", () => {
    assert.equal(canSetQuoteStatus("rejected", "draft"), true);
  });

  it("allows same-status (e.g. re-send)", () => {
    assert.equal(canSetQuoteStatus("sent", "sent"), true);
  });

  it("keeps approved quotes final", () => {
    assert.equal(canSetQuoteStatus("approved", "draft"), false);
    assert.equal(canSetQuoteStatus("approved", "sent"), false);
    assert.equal(canSetQuoteStatus("approved", "rejected"), false);
  });

  it("blocks draft from skipping to approved/rejected", () => {
    assert.equal(canSetQuoteStatus("draft", "approved"), false);
    assert.equal(canSetQuoteStatus("draft", "rejected"), false);
  });

  it("blocks sent back to draft", () => {
    assert.equal(canSetQuoteStatus("sent", "draft"), false);
  });
});
