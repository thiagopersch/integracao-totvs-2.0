import { headers } from "next/headers";

export type RequestContext = {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
  permissions: string[];
};

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const organizationId = h.get("x-organization-id");
  if (!userId || !organizationId) {
    throw new Error("Contexto de autenticação ausente");
  }
  let permissions: string[] = [];
  try {
    permissions = JSON.parse(h.get("x-user-permissions") || "[]");
  } catch {
    permissions = [];
  }
  return {
    userId,
    email: h.get("x-user-email") || "",
    role: h.get("x-user-role") || "USER",
    organizationId,
    permissions,
  };
}

export async function getCurrentOrganizationId(): Promise<string> {
  const { organizationId } = await getRequestContext();
  return organizationId;
}
