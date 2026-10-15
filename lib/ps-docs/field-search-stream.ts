import type { ActionCatalogEntries } from "@/lib/ps-docs/server/process-structure";
import type { ProcessSearchSource } from "@/lib/ps-docs/field-search";
import type { PaginaSpec, PopupSpec, PortalOverviewSpec } from "@/lib/ps-docs/types";

/** Wire format of `POST /api/ps-field-search` (client-safe): one JSON event per line (NDJSON),
 *  emitted by `runFieldSearchSweep` as each piece of the structure is read. */

export type StandaloneContainer = { kind: "popup"; spec: PopupSpec } | { kind: "page"; spec: PaginaSpec };

export type SweepEvent =
  | { type: "progress"; label: string; done: number; total: number }
  | { type: "overview"; portal: string; spec: PortalOverviewSpec }
  | { type: "source"; source: ProcessSearchSource }
  | { type: "standalone"; containers: StandaloneContainer[] }
  | { type: "warning"; messages: string[] }
  | { type: "done"; portal: string; fieldCatalogEntries: [number, string][]; actionCatalogEntries?: ActionCatalogEntries }
  | { type: "error"; error: string };

/** Splits a byte stream into lines and parses each as one event — a line may arrive split across
 *  chunks, so the trailing partial line is kept until the next chunk (or the end) completes it. */
export async function readNdjson<T>(body: ReadableStream<Uint8Array>, onEvent: (event: T) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (text: string) => {
    for (const line of text.split("\n")) if (line.trim()) onEvent(JSON.parse(line) as T);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const end = buffer.lastIndexOf("\n");
    if (end >= 0) {
      flush(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
    }
  }
  flush(buffer + decoder.decode());
}
