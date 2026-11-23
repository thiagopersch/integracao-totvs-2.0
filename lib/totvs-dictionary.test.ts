import { describe, expect, it } from "vitest";
import { dictionaryCsvHeader, dictionaryCsvLines, dictionaryKey, parseDictionaryFile, parseDictionaryKey } from "./totvs-dictionary";

const enc = (s: string) => new TextEncoder().encode(s);

describe("parseDictionaryFile", () => {
  it("reads the spreadsheet layout, normalizes and dedupes", () => {
    const csv = 'TABELA,COLUNA,DESCRIÇÃO\naabonfun,#,"Abonos, lançados"\nAABONFUN,CHAPA,Chapa do Funcionário\nAABONFUN,CHAPA,Chapa (nova)\n,X,sem tabela\nA|B,C,inválida\n';
    const r = parseDictionaryFile(enc(csv));
    expect(r.read).toBe(5);
    expect(r.skipped).toBe(2);
    expect(r.rows).toEqual([
      { table: "AABONFUN", column: "#", description: "Abonos, lançados" },
      { table: "AABONFUN", column: "CHAPA", description: "Chapa (nova)" },
    ]);
  });

  it("round-trips through the CSV export", () => {
    const rows = [{ table: "T", column: "C", description: 'Diz "oi", tchau\nlinha 2' }];
    const back = parseDictionaryFile(enc(dictionaryCsvHeader() + dictionaryCsvLines(rows)));
    expect(back.rows).toEqual(rows);
  });
});

describe("dictionary keys", () => {
  it("encodes and decodes TABELA|COLUNA", () => {
    expect(parseDictionaryKey(dictionaryKey({ table: "SCURSO", column: "#" }))).toEqual({ table: "SCURSO", column: "#" });
    expect(parseDictionaryKey("SEMCOLUNA")).toBeNull();
    expect(parseDictionaryKey("|X")).toBeNull();
  });
});
