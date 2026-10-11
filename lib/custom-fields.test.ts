import { describe, expect, it } from "vitest";
import {
  buildCustomFieldWhere,
  buildCustomFieldsSchema,
  formatCustomFieldValue,
  mergeCustomFieldValues,
  type CustomFieldDef,
} from "@/lib/custom-fields";

function def(partial: Partial<CustomFieldDef> & Pick<CustomFieldDef, "id" | "type">): CustomFieldDef {
  return {
    entity: "PROJECT",
    label: partial.id,
    required: false,
    options: null,
    position: 0,
    showInList: false,
    status: true,
    ...partial,
  };
}

const options = [
  { id: "o1", label: "Alta" },
  { id: "o2", label: "Baixa" },
];

describe("buildCustomFieldsSchema", () => {
  it("validates each type and normalizes empty values to null", () => {
    const schema = buildCustomFieldsSchema([
      def({ id: "t", type: "TEXT" }),
      def({ id: "n", type: "NUMBER" }),
      def({ id: "c", type: "CURRENCY" }),
      def({ id: "d", type: "DATE" }),
      def({ id: "s", type: "SELECT", options }),
      def({ id: "m", type: "MULTISELECT", options }),
      def({ id: "b", type: "BOOLEAN" }),
      def({ id: "u", type: "URL" }),
    ]);
    const parsed = schema.parse({
      t: "  olá ",
      n: "12.5",
      c: 1000,
      d: "2026-10-11",
      s: "o1",
      m: ["o1", "o2"],
      b: false,
      u: "",
      unknown: "dropped",
    });
    expect(parsed).toEqual({ t: "olá", n: 12.5, c: 1000, d: "2026-10-11", s: "o1", m: ["o1", "o2"], b: false, u: null });
  });

  it("rejects invalid option ids, dates and urls", () => {
    const schema = buildCustomFieldsSchema([
      def({ id: "s", type: "SELECT", options }),
      def({ id: "d", type: "DATE" }),
      def({ id: "u", type: "URL" }),
    ]);
    const result = schema.safeParse({ s: "nope", d: "11/10/2026", u: "not a url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(["d", "s", "u"]);
  });

  it("enforces required unless partial", () => {
    const defs = [def({ id: "r", type: "TEXT", required: true })];
    expect(buildCustomFieldsSchema(defs).safeParse({}).success).toBe(false);
    expect(buildCustomFieldsSchema(defs).safeParse({ r: "" }).success).toBe(false);
    expect(buildCustomFieldsSchema(defs, { partial: true }).safeParse({}).success).toBe(true);
    // false is a real answer for a required yes/no field
    expect(buildCustomFieldsSchema([def({ id: "b", type: "BOOLEAN", required: true })]).safeParse({ b: false }).success).toBe(true);
  });
});

describe("mergeCustomFieldValues", () => {
  it("replaces active definitions and keeps inactive ones", () => {
    const merged = mergeCustomFieldValues({ a: "old", inactive: "keep", b: "x" }, { a: "new", b: null }, ["a", "b"]);
    expect(merged).toEqual({ a: "new", inactive: "keep" });
  });

  it("leaves active keys absent from the input untouched", () => {
    expect(mergeCustomFieldValues({ a: 1 }, {}, ["a"])).toEqual({ a: 1 });
  });
});

describe("formatCustomFieldValue", () => {
  it("renders option labels, dates, booleans and currency", () => {
    expect(formatCustomFieldValue({ type: "SELECT", options }, "o2")).toBe("Baixa");
    expect(formatCustomFieldValue({ type: "MULTISELECT", options }, ["o1", "o2"])).toBe("Alta, Baixa");
    expect(formatCustomFieldValue({ type: "DATE", options: null }, "2026-10-11")).toBe("11/10/2026");
    expect(formatCustomFieldValue({ type: "BOOLEAN", options: null }, true)).toBe("Sim");
    expect(formatCustomFieldValue({ type: "CURRENCY", options: null }, 10)).toMatch(/R\$\s?10,00/);
    expect(formatCustomFieldValue({ type: "USER", options: null }, "u1", { u1: "Ana" })).toBe("Ana");
    expect(formatCustomFieldValue({ type: "TEXT", options: null }, null)).toBe("");
  });
});

describe("buildCustomFieldWhere", () => {
  it("maps cf_ params to Json path filters", () => {
    const where = buildCustomFieldWhere(
      [def({ id: "t", type: "TEXT" }), def({ id: "m", type: "MULTISELECT" }), def({ id: "b", type: "BOOLEAN" }), def({ id: "x", type: "SELECT" })],
      { cf_t: "abc", cf_m: "o1", cf_b: "true", cf_x: "" },
    );
    expect(where).toEqual([
      { customFields: { path: ["t"], string_contains: "abc" } },
      { customFields: { path: ["m"], array_contains: ["o1"] } },
      { customFields: { path: ["b"], equals: true } },
    ]);
  });
});
