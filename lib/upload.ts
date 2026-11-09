import { createHash } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { put } from "@vercel/blob"
import sharp from "sharp"
import { getIntegrationConfig } from "@/lib/integration-config"

export type ImageKind = "logo" | "favicon" | "background"

const IMAGE_RULES: Record<ImageKind, { types: string[]; maxSize: number; label: string }> = {
  logo: {
    types: ["image/webp", "image/svg+xml", "image/jpeg", "image/png"],
    maxSize: 2 * 1024 * 1024,
    label: "WEBP, SVG, JPEG ou PNG de no máximo 2MB",
  },
  favicon: {
    types: ["image/jpeg", "image/png", "image/x-icon", "image/vnd.microsoft.icon"],
    maxSize: 2 * 1024 * 1024,
    label: "JPEG, PNG ou ICO de no máximo 2MB",
  },
  background: {
    types: ["image/webp", "image/jpeg", "image/png", "image/svg+xml"],
    maxSize: 5 * 1024 * 1024,
    label: "WEBP, JPEG, PNG ou SVG de no máximo 5MB",
  },
}

/** Raster formats re-encoded as WebP before storing. SVG (vector), GIF (may be animated) and ICO stay as sent. */
const CONVERTIBLE_TYPES = new Set(["image/png", "image/jpeg"])
const MAX_DIMENSION = 2000
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/webp": ".webp",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
}

export type PreparedUpload = { body: Buffer; contentType: string; extension: string }

/**
 * PNG/JPEG → WebP (quality 82), scaled down to fit 2000×2000 (never enlarged), EXIF orientation
 * applied. Anything else — or an image sharp can't decode — is stored byte for byte.
 */
export async function prepareUpload(input: Buffer, contentType: string, originalName = ""): Promise<PreparedUpload> {
  const fallbackExt = EXTENSION_BY_TYPE[contentType] ?? (path.extname(originalName).toLowerCase() || ".bin")
  if (!CONVERTIBLE_TYPES.has(contentType)) return { body: input, contentType, extension: fallbackExt }
  try {
    const body = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    return { body, contentType: "image/webp", extension: ".webp" }
  } catch {
    return { body: input, contentType, extension: fallbackExt }
  }
}

/** Content-addressed name: the same bytes always get the same URL, so it can be cached forever. */
export function contentHashName(body: Buffer, extension: string): string {
  return `${createHash("sha256").update(body).digest("hex").slice(0, 32)}${extension}`
}

/**
 * Stores an upload and returns its public URL. The file name is replaced by the hash of the
 * (optimized) content — only the directory of `relativePath` is kept — so the URL changes whenever
 * the content does and the CDN/browser can cache it for a year (`immutable`).
 *
 * Em desenvolvimento local os arquivos ficam em public/storage (sem depender de credenciais do
 * Vercel Blob); em produção (Vercel) vão para o Vercel Blob, já que o filesystem do deploy é
 * somente leitura.
 */
export async function storeUploadedFile(file: File, relativePath: string, options: { organizationId?: string } = {}): Promise<string> {
  const prepared = await prepareUpload(Buffer.from(await file.arrayBuffer()), file.type, file.name)
  const storedPath = path.posix.join(path.posix.dirname(relativePath), contentHashName(prepared.body, prepared.extension))

  if (process.env.NODE_ENV === "development") {
    const filePath = path.join(process.cwd(), "public", "storage", storedPath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, prepared.body)
    return `/storage/${storedPath}`
  }

  const { timeoutMs } = await getIntegrationConfig(options.organizationId, "BLOB")
  const blob = await put(`uploads/${storedPath}`, prepared.body, {
    access: "public",
    addRandomSuffix: false,
    // Same name = same bytes, so re-uploading an identical file just rewrites it.
    allowOverwrite: true,
    contentType: prepared.contentType,
    cacheControlMaxAge: ONE_YEAR_SECONDS,
    abortSignal: AbortSignal.timeout(timeoutMs),
  })

  return blob.url
}

export async function saveImageUpload(file: File, kind: ImageKind = "logo", options: { organizationId?: string } = {}): Promise<string> {
  const rule = IMAGE_RULES[kind]

  if (!rule.types.includes(file.type)) {
    throw new Error(`Tipo de arquivo inválido. Envie uma imagem ${rule.label}.`)
  }
  if (file.size > rule.maxSize) {
    throw new Error(`Imagem muito grande. Envie uma imagem ${rule.label}.`)
  }

  return storeUploadedFile(file, `${kind}/upload`, options)
}
