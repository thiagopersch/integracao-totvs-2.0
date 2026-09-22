"use server";

import { randomUUID } from "crypto";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { storeUploadedFile } from "@/lib/upload";

const MAX_SIZE_BY_KIND = {
  logo: 5 * 1024 * 1024,
  background: 10 * 1024 * 1024,
} as const;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

export async function uploadMapeadorImagem(formData: FormData) {
  await requirePermission("mapeador_projetos", "update");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false as const, error: "Nenhum arquivo enviado" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false as const, error: "Formato de imagem não suportado" };
  }
  const kind = formData.get("kind") === "background" ? "background" : "logo";
  const maxSize = MAX_SIZE_BY_KIND[kind];
  if (file.size > maxSize) {
    return { success: false as const, error: `Imagem maior que ${maxSize / (1024 * 1024)}MB` };
  }

  try {
    const ext = path.extname(file.name) || ".png";
    const fileName = `${randomUUID()}${ext}`;
    const url = await storeUploadedFile(file, `mapeador/${kind}/${fileName}`);

    return { success: true as const, url };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
