import { z } from "zod"
import { psCredentialsSchema } from "@/schemas/ps-docs.schema"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)")

export const logFilterSchema = z
  .object({
    credentials: psCredentialsSchema,
    type: z.enum(["error", "info", "all"]),
    /** Optional period — without it Rubeus returns the most recent logs. */
    from: isoDate.optional(),
    to: isoDate.optional(),
    portalId: z.coerce.number().int().positive("Selecione o portal"),
    selectiveProcessId: z.coerce.number().int().positive().optional(),
    /** Rubeus' `duration` filter: only logs that took at least this long (ms). */
    minDurationMs: z.coerce.number().int().min(0).max(30_000).optional(),
  })
  .refine((d) => !d.from === !d.to, { message: "Informe a data inicial e a final do período", path: ["to"] })
  .refine((d) => !d.from || !d.to || d.from <= d.to, { message: "A data inicial deve ser anterior ou igual à final", path: ["to"] })

export const logProcessesSchema = z.object({
  credentials: psCredentialsSchema,
  portalId: z.coerce.number().int().positive("Selecione o portal"),
})

export const logShowSchema = z.object({
  credentials: psCredentialsSchema,
  categoriesId: z.string().trim().min(1, "Categoria do log ausente"),
  id: z.coerce.number().int().positive(),
})

/** Body of `POST /api/rubeus-logs/file`: only Rubeus' own log bucket on Google Cloud Storage is proxied. */
export const logFileSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => {
      try {
        const parsed = new URL(u)
        return parsed.protocol === "https:" && parsed.hostname === "storage.googleapis.com" && parsed.pathname.startsWith("/rb-arquivos/")
      } catch {
        return false
      }
    }, "Link de arquivo não permitido"),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[\w.-]+$/, "Nome de arquivo inválido"),
})

export type LogFilterInput = z.input<typeof logFilterSchema>
export type LogProcessesInput = z.input<typeof logProcessesSchema>
export type LogShowInput = z.input<typeof logShowSchema>
