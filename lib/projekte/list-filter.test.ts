import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesProjekteListFilter } from "@/lib/projekte/list-filter";

describe("matchesProjekteListFilter", () => {
  it("matches exact status filter", () => {
    assert.equal(matchesProjekteListFilter("abrechnen", "abrechnen"), true);
    assert.equal(matchesProjekteListFilter("offen", "abrechnen"), false);
  });

  it("active excludes abgeschlossen", () => {
    assert.equal(matchesProjekteListFilter("bestellt", "active"), true);
    assert.equal(matchesProjekteListFilter("abgeschlossen", "active"), false);
  });

  it("all includes every status", () => {
    assert.equal(matchesProjekteListFilter("abgeschlossen", "all"), true);
    assert.equal(matchesProjekteListFilter("offen", "all"), true);
  });

  it("archived matches any status (server scopes by archived_at)", () => {
    assert.equal(matchesProjekteListFilter("abgeschlossen", "archived"), true);
    assert.equal(matchesProjekteListFilter("offen", "archived"), true);
  });
});
