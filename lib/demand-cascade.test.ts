import { describe, expect, it } from "vitest";
import { autoPickSingle, departmentsForRequesters, pruneSelection, requestersForClient } from "./demand-cascade";

const requesters = [
  { id: "A", clientIds: ["X"] },
  { id: "B", clientIds: ["X"] },
  { id: "C", clientIds: ["Y"] },
  { id: "L", clientIds: [] },
  { id: "M", clientIds: ["X", "Y"] },
];
const departments = [
  { id: "dB", clientIds: ["X"], requesterIds: ["A"] },
  { id: "dD", clientIds: ["X"], requesterIds: ["B"] },
  { id: "dY", clientIds: ["Y"], requesterIds: ["C"] },
  { id: "dShared", clientIds: ["X"], requesterIds: ["A", "B"] },
  { id: "dMulti", clientIds: ["X", "Y"], requesterIds: ["B", "C"] },
];

describe("requestersForClient", () => {
  it("lists only the client's requesters", () => {
    expect(requestersForClient(requesters, "X").map((r) => r.id)).toEqual(["A", "B", "M"]);
  });

  it("lists a requester under every client it belongs to", () => {
    expect(requestersForClient(requesters, "Y").map((r) => r.id)).toEqual(["C", "M"]);
  });

  it("lists nothing without a client, except kept ids", () => {
    expect(requestersForClient(requesters, "")).toEqual([]);
    expect(requestersForClient(requesters, "", ["L"]).map((r) => r.id)).toEqual(["L"]);
  });

  it("keeps an already-saved legacy requester listed", () => {
    expect(requestersForClient(requesters, "X", ["L"]).map((r) => r.id)).toEqual(["A", "B", "L", "M"]);
  });
});

describe("departmentsForRequesters", () => {
  it("lists the departments of one requester", () => {
    expect(departmentsForRequesters(departments, "X", ["A"]).map((d) => d.id)).toEqual(["dB", "dShared"]);
  });

  it("unions the departments of several requesters", () => {
    expect(departmentsForRequesters(departments, "X", ["A", "B"]).map((d) => d.id)).toEqual(["dB", "dD", "dShared", "dMulti"]);
  });

  it("lists a department shared by several clients for each of them", () => {
    expect(departmentsForRequesters(departments, "Y", ["C"]).map((d) => d.id)).toEqual(["dY", "dMulti"]);
  });

  it("skips a requester's department that doesn't apply to the demand's client", () => {
    expect(departmentsForRequesters(departments, "Y", ["B"]).map((d) => d.id)).toEqual(["dMulti"]);
    expect(departmentsForRequesters(departments, "Z", ["B"])).toEqual([]);
  });

  it("keeps an already-saved department listed", () => {
    expect(departmentsForRequesters(departments, "Z", [], ["dB"]).map((d) => d.id)).toEqual(["dB"]);
  });

  it("lists nothing without requesters", () => {
    expect(departmentsForRequesters(departments, "X", [])).toEqual([]);
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
