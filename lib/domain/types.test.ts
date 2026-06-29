import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextProjectStatusAfterAppointmentBooked } from "@/lib/domain/types";

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
