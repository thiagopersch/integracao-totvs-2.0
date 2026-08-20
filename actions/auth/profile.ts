"use server"

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/tenant";
import { nameSchema } from "@/lib/validators";
import { z } from "zod";

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
    });
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
