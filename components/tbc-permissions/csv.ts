import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"

/** Downloads `rows` as a ";"-separated CSV with BOM — opens with accents intact in Excel pt-BR. */
export function downloadCsv(header: string[], rows: string[][], name: string) {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [header, ...rows].map((r) => r.map(quote).join(";"))
  downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${slugify(name)}.csv`)
}
