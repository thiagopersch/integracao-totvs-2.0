"use server"

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/tenant";
import { nameSchema } from "@/lib/validators";
import { z } from "zod";
import { DEFAULT_THEME_COLOR, THEME_COLOR_KEYS } from "@/constants/theme-colors";

const updateProfileSchema = z.object({
  name: nameSchema("Nome"),
  image: z.string().url("URL inválida").optional().or(z.literal("")),
});

export async function updateProfileAction(formData: FormData) {
  const { userId } = await getRequestContext();
  const data = {
    name: formData.get("name") as string,
    image: (formData.get("image") as string) || "",
  };

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name, image: parsed.data.image || null },
      omit: { password: true },
    });
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

const themeColorSchema = z.enum(THEME_COLOR_KEYS);

/** Saves the primary color picked on the profile; "default" is stored as null. */
export async function updateThemeColorAction(color: string) {
  const { userId } = await getRequestContext();
  const parsed = themeColorSchema.safeParse(color);
  if (!parsed.success) return { success: false, error: "Cor inválida" };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { themeColor: parsed.data === DEFAULT_THEME_COLOR ? null : parsed.data },
      select: { id: true },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
