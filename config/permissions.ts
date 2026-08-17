import { Role } from "@prisma/client";

export type Permission = {
  code: string;
  name: string;
  description: string;
  module: string;
};

export const PERMISSIONS: Permission[] = [
  { code: "users:read", name: "Listar Usuários", description: "Visualizar lista de usuários", module: "users" },
  { code: "users:create", name: "Criar Usuários", description: "Criar novos usuários", module: "users" },
  { code: "users:update", name: "Atualizar Usuários", description: "Editar usuários existentes", module: "users" },
  { code: "users:delete", name: "Excluir Usuários", description: "Excluir usuários", module: "users" },
  { code: "dataservers:read", name: "Listar Dataservers", description: "Visualizar lista de dataservers", module: "dataservers" },
  { code: "dataservers:create", name: "Criar Dataservers", description: "Criar novos dataservers", module: "dataservers" },
  { code: "dataservers:update", name: "Atualizar Dataservers", description: "Editar dataservers", module: "dataservers" },
  { code: "dataservers:delete", name: "Excluir Dataservers", description: "Excluir dataservers", module: "dataservers" },
  { code: "processes:read", name: "Listar Processos", description: "Visualizar lista de processos", module: "processes" },
  { code: "processes:create", name: "Criar Processos", description: "Criar novos processos", module: "processes" },
  { code: "processes:update", name: "Atualizar Processos", description: "Editar processos", module: "processes" },
  { code: "processes:delete", name: "Excluir Processos", description: "Excluir processos", module: "processes" },
  { code: "clients:read", name: "Listar Clientes", description: "Visualizar lista de clientes", module: "clients" },
  { code: "clients:create", name: "Criar Clientes", description: "Criar novos clientes", module: "clients" },
  { code: "clients:update", name: "Atualizar Clientes", description: "Editar clientes", module: "clients" },
  { code: "clients:delete", name: "Excluir Clientes", description: "Excluir clientes", module: "clients" },
  { code: "tbcs:read", name: "Listar TBCs", description: "Visualizar lista de TBCs", module: "tbcs" },
  { code: "tbcs:create", name: "Criar TBCs", description: "Criar novos TBCs", module: "tbcs" },
  { code: "tbcs:update", name: "Atualizar TBCs", description: "Editar TBCs", module: "tbcs" },
  { code: "tbcs:delete", name: "Excluir TBCs", description: "Excluir TBCs", module: "tbcs" },
  { code: "filters:read", name: "Listar Filtros", description: "Visualizar lista de filtros", module: "filters" },
  { code: "filters:create", name: "Criar Filtros", description: "Criar novos filtros", module: "filters" },
  { code: "filters:update", name: "Atualizar Filtros", description: "Editar filtros", module: "filters" },
  { code: "filters:delete", name: "Excluir Filtros", description: "Excluir filtros", module: "filters" },
  { code: "backups:read", name: "Listar Backups", description: "Visualizar lista de backups", module: "backups" },
  { code: "backups:create", name: "Criar Backups", description: "Criar novos backups", module: "backups" },
  { code: "backups:update", name: "Atualizar Backups", description: "Editar backups", module: "backups" },
  { code: "backups:delete", name: "Excluir Backups", description: "Excluir backups", module: "backups" },
  { code: "soap:execute", name: "Executar SOAP", description: "Executar chamadas SOAP", module: "soap" },
  { code: "soap:history", name: "Ver Histórico", description: "Visualizar histórico SOAP", module: "soap" },
  { code: "dashboard:view", name: "Ver Dashboard", description: "Visualizar dashboard", module: "dashboard" },
  { code: "settings:manage", name: "Gerenciar Configurações", description: "Gerenciar configurações do sistema", module: "settings" },
];

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.code),
  MANAGER: [
    "clients:read", "clients:create", "clients:update",
    "tbcs:read", "tbcs:create", "tbcs:update",
    "filters:read", "filters:create", "filters:update",
    "backups:read", "backups:create", "backups:update",
    "dataservers:read", "processes:read",
    "soap:execute", "soap:history",
    "dashboard:view",
  ],
  USER: [
    "clients:read", "tbcs:read", "filters:read", "backups:read",
    "dataservers:read", "processes:read",
    "soap:execute", "soap:history",
    "dashboard:view",
  ],
};
