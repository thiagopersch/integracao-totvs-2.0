import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_")
}

export async function saveImageUpload(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Tipo de arquivo inválido. Envie uma imagem PNG, JPEG, WEBP ou GIF.")
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Imagem muito grande. O tamanho máximo é 5MB.")
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })

  const fileName = `${randomUUID()}-${sanitizeFileName(file.name)}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadsDir, fileName), buffer)

  return `/uploads/${fileName}`
}
