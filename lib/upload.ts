import { randomUUID } from "crypto"
import { put } from "@vercel/blob"

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

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_")
}

export async function saveImageUpload(file: File, kind: ImageKind = "logo"): Promise<string> {
  const rule = IMAGE_RULES[kind]

  if (!rule.types.includes(file.type)) {
    throw new Error(`Tipo de arquivo inválido. Envie uma imagem ${rule.label}.`)
  }
  if (file.size > rule.maxSize) {
    throw new Error(`Imagem muito grande. Envie uma imagem ${rule.label}.`)
  }

  const fileName = `${randomUUID()}-${sanitizeFileName(file.name)}`
  const blob = await put(`uploads/${kind}/${fileName}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  })

  return blob.url
}
