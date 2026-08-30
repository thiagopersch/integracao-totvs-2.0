/**
 * Enforces per-user client access (see UserClient) on top of organization-level tenancy.
 * No exceptions by role — an empty `allowedClientIds` means the user sees nothing client-scoped,
 * admins included.
 */

export class ClientAccessDeniedError extends Error {
  constructor() {
    super("Cliente fora do seu escopo de acesso");
    this.name = "ClientAccessDeniedError";
  }
}

export function assertClientAllowed(clientId: string, allowedClientIds: string[]) {
  if (!allowedClientIds.includes(clientId)) {
    throw new ClientAccessDeniedError();
  }
}
