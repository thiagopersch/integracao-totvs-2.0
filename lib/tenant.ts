import { auth } from "@/auth";

export type RequestContext = {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
  permissions: string[];
  allowedClientIds: string[];
};

export async function getRequestContext(): Promise<RequestContext> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Contexto de autenticação ausente");
  }

  return {
    userId: session.user.id,
    email: session.user.email || "",
    role: session.user.role,
    organizationId: session.user.organizationId,
    permissions: session.user.permissions || [],
    allowedClientIds: session.user.allowedClientIds || [],
  };
}

export async function getCurrentOrganizationId(): Promise<string> {
  const { organizationId } = await getRequestContext();
  return organizationId;
}
