import { describe, expect, it } from "vitest";
import { autoPickSingle, departmentsForRequesters, pruneSelection, requestersForClient } from "./demand-cascade";

const requesters = [
  { id: "A", clientId: "X" },
  { id: "B", clientId: "X" },
  { id: "C", clientId: "Y" },
  { id: "L", clientId: null },
];
const departments = [
  { id: "dB", requesterIds: ["A"] },
  { id: "dD", requesterIds: ["B"] },
  { id: "dY", requesterIds: ["C"] },
  { id: "dShared", requesterIds: ["A", "B"] },
];

describe("requestersForClient", () => {
  it("lists only the client's requesters", () => {
    expect(requestersForClient(requesters, "X").map((r) => r.id)).toEqual(["A", "B"]);
  });

  it("lists nothing without a client, except kept ids", () => {
    expect(requestersForClient(requesters, "")).toEqual([]);
    expect(requestersForClient(requesters, "", ["L"]).map((r) => r.id)).toEqual(["L"]);
  });

  it("keeps an already-saved legacy requester listed", () => {
    expect(requestersForClient(requesters, "X", ["L"]).map((r) => r.id)).toEqual(["A", "B", "L"]);
  });
});

describe("departmentsForRequesters", () => {
  it("lists the departments of one requester", () => {
    expect(departmentsForRequesters(departments, ["A"]).map((d) => d.id)).toEqual(["dB", "dShared"]);
  });

  it("unions the departments of several requesters", () => {
    expect(departmentsForRequesters(departments, ["A", "B"]).map((d) => d.id)).toEqual(["dB", "dD", "dShared"]);
  });

  it("lists nothing without requesters", () => {
    expect(departmentsForRequesters(departments, [])).toEqual([]);
  });
});

describe("pruneSelection", () => {
  it("drops ids that are no longer options", () => {
    expect(pruneSelection(["dB", "dD"], [{ id: "dB" }])).toEqual(["dB"]);
  });
});

describe("autoPickSingle", () => {
  it("picks the only option when nothing is selected", () => {
    expect(autoPickSingle([], [{ id: "A" }])).toEqual(["A"]);
  });

  it("leaves it empty when there is more than one option", () => {
    expect(autoPickSingle([], [{ id: "A" }, { id: "B" }])).toEqual([]);
  });

  it("keeps an existing selection", () => {
    expect(autoPickSingle(["B"], [{ id: "A" }])).toEqual(["B"]);
  });
});
