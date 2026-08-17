import { PrismaClient, Role, SoapMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.appConfig.deleteMany();
  await prisma.soapFavorite.deleteMany();
  await prisma.soapTemplate.deleteMany();
  await prisma.soapLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.backup.deleteMany();
  await prisma.filter.deleteMany();
  await prisma.tbc.deleteMany();
  await prisma.sentence.deleteMany();
  await prisma.sentenceCategory.deleteMany();
  await prisma.client.deleteMany();
  await prisma.process.deleteMany();
  await prisma.dataserver.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@totvs.com.br",
      password: hashedPassword,
      role: Role.ADMIN,
      status: true,
      changePassword: false,
    },
  });

  await prisma.user.createMany({
    data: [
      { name: "Gerente Geral", email: "gerente@totvs.com.br", password: hashedPassword, role: Role.MANAGER, status: true },
      { name: "Usuário Teste", email: "usuario@totvs.com.br", password: hashedPassword, role: Role.USER, status: true },
    ],
  });

  console.log("✅ Users seeded");

  const restDataserver = await prisma.dataserver.create({
    data: { code: "REST", name: "Dataserver REST", nameAlternative: "REST API" },
  });

  await prisma.dataserver.createMany({
    data: [
      { code: "RM", name: "Dataserver RM", nameAlternative: "RM Principal" },
      { code: "RMTHOMAS", name: "Dataserver RM Thomas", nameAlternative: "RM Thomas" },
      { code: "RMGPE", name: "Dataserver RM GPE", nameAlternative: "RM GPE" },
      { code: "RMAD", name: "Dataserver RM AD", nameAlternative: "RM Administrativo" },
      { code: "RMCDC", name: "Dataserver RM CDC", nameAlternative: "RM CDC" },
    ],
  });

  console.log("✅ Dataservers seeded");

  await prisma.process.createMany({
    data: [
      { code: "INTEGRACAO_CLIENTE", name: "Integração de Cliente", nameAlternative: "Sync Cliente" },
      { code: "INTEGRACAO_CONTRATO", name: "Integração de Contrato", nameAlternative: "Sync Contrato" },
      { code: "INTEGRACAO_FINANCEIRO", name: "Integração Financeira", nameAlternative: "Sync Financeiro" },
      { code: "CONSULTA_ALUNO", name: "Consulta de Aluno", nameAlternative: "Query Aluno" },
      { code: "CONSULTA_TURMA", name: "Consulta de Turma", nameAlternative: "Query Turma" },
      { code: "LANCAMENTO_NOTA", name: "Lançamento de Nota", nameAlternative: "Nota Aluno" },
    ],
  });

  console.log("✅ Processes seeded");

  await prisma.client.createMany({
    data: [
      { name: "Universidade Exemplo", linkCrm: "uni-exemplo", site: "https://exemplo.edu.br", status: true },
      { name: "Colégio Modelo", linkCrm: "colegio-modelo", site: "https://colegiomodelo.com.br", status: true },
      { name: "Escola Técnica Nacional", linkCrm: "etn", site: "https://etn.edu.br", status: true },
      { name: "Faculdade Integrada", linkCrm: "faculdade-integrada", site: "https://facintegrada.edu.br", status: true },
    ],
  });

  console.log("✅ Clients seeded");

  const clients = await prisma.client.findMany();

  for (const client of clients) {
    await prisma.tbc.create({
      data: {
        clientId: client.id,
        name: `TBC ${client.name}`,
        link: `https://${client.linkCrm}.totvs.com.br:8080/dataserver`,
        user: "admin",
        password: "totvs@123",
        notRequiredLicense: false,
        status: true,
      },
    });
  }

  console.log("✅ TBCs seeded");

  const tbcs = await prisma.tbc.findMany();

  for (const tbc of tbcs) {
    await prisma.filter.create({
      data: {
        tbcId: tbc.id,
        clientId: tbc.clientId,
        filter: "FILTRO_PADRAO",
        coligateContext: 1,
        branchContext: 1,
        levelEducationContext: 1,
        codSystemContext: "SISTEMA_PADRAO",
        userContext: "admin",
        status: true,
      },
    });
  }

  console.log("✅ Filters seeded");

  const filters = await prisma.filter.findMany();

  for (const filter of filters) {
    await prisma.backup.create({
      data: {
        tbcId: filter.tbcId,
        filterId: filter.id,
        branchSentence: "1",
        codSystem: "SISTEMA_PADRAO",
        codeSentence: "BACKUP_PADRAO",
        nameSentence: "Backup Padrão",
        contentSentence: "<sentence><name>Backup Padrão</name><code>BACKUP_PADRAO</code></sentence>",
      },
    });
  }

  console.log("✅ Backups seeded");

  const catMatricula = await prisma.sentenceCategory.create({
    data: { code: "MATRICULA", name: "Matrícula", status: true },
  });
  const catFinanceiro = await prisma.sentenceCategory.create({
    data: { code: "FINANCEIRO", name: "Financeiro", status: true },
  });
  const catAcademico = await prisma.sentenceCategory.create({
    data: { code: "ACADEMICO", name: "Acadêmico", status: true },
  });

  console.log("✅ Sentence Categories seeded");

  await prisma.sentence.createMany({
    data: [
      { sentenceCategoryId: catMatricula.id, code: "REALIZAR_MATRICULA", name: "Realizar Matrícula", codSystem: "SISTEMA_PADRAO", status: true },
      { sentenceCategoryId: catMatricula.id, code: "CANCELAR_MATRICULA", name: "Cancelar Matrícula", codSystem: "SISTEMA_PADRAO", status: true },
      { sentenceCategoryId: catFinanceiro.id, code: "GERAR_BOLETO", name: "Gerar Boleto", codSystem: "SISTEMA_PADRAO", status: true },
      { sentenceCategoryId: catFinanceiro.id, code: "BAIXAR_TITULO", name: "Baixar Título", codSystem: "SISTEMA_PADRAO", status: true },
      { sentenceCategoryId: catAcademico.id, code: "LANCAR_NOTA", name: "Lançar Nota", codSystem: "SISTEMA_PADRAO", status: true },
      { sentenceCategoryId: catAcademico.id, code: "CONSULTAR_HISTORICO", name: "Consultar Histórico", codSystem: "SISTEMA_PADRAO", status: true },
    ],
  });

  console.log("✅ Sentences seeded");

  const permissionData = [
    { code: "users:read", name: "Listar Usuários", description: "Visualizar lista de usuários", module: "users" },
    { code: "users:create", name: "Criar Usuários", description: "Criar novos usuários", module: "users" },
    { code: "users:update", name: "Atualizar Usuários", description: "Editar usuários existentes", module: "users" },
    { code: "users:delete", name: "Excluir Usuários", description: "Excluir usuários", module: "users" },
    { code: "dataservers:read", name: "Listar Dataservers", description: "Visualizar lista", module: "dataservers" },
    { code: "dataservers:create", name: "Criar Dataservers", description: "Criar novos", module: "dataservers" },
    { code: "dataservers:update", name: "Atualizar Dataservers", description: "Editar", module: "dataservers" },
    { code: "dataservers:delete", name: "Excluir Dataservers", description: "Excluir", module: "dataservers" },
    { code: "processes:read", name: "Listar Processos", description: "Visualizar lista", module: "processes" },
    { code: "processes:create", name: "Criar Processos", description: "Criar novos", module: "processes" },
    { code: "processes:update", name: "Atualizar Processos", description: "Editar", module: "processes" },
    { code: "processes:delete", name: "Excluir Processos", description: "Excluir", module: "processes" },
    { code: "clients:read", name: "Listar Clientes", description: "Visualizar lista", module: "clients" },
    { code: "clients:create", name: "Criar Clientes", description: "Criar novos", module: "clients" },
    { code: "clients:update", name: "Atualizar Clientes", description: "Editar", module: "clients" },
    { code: "clients:delete", name: "Excluir Clientes", description: "Excluir", module: "clients" },
    { code: "tbcs:read", name: "Listar TBCs", description: "Visualizar lista", module: "tbcs" },
    { code: "tbcs:create", name: "Criar TBCs", description: "Criar novos", module: "tbcs" },
    { code: "tbcs:update", name: "Atualizar TBCs", description: "Editar", module: "tbcs" },
    { code: "tbcs:delete", name: "Excluir TBCs", description: "Excluir", module: "tbcs" },
    { code: "filters:read", name: "Listar Filtros", description: "Visualizar lista", module: "filters" },
    { code: "filters:create", name: "Criar Filtros", description: "Criar novos", module: "filters" },
    { code: "filters:update", name: "Atualizar Filtros", description: "Editar", module: "filters" },
    { code: "filters:delete", name: "Excluir Filtros", description: "Excluir", module: "filters" },
    { code: "backups:read", name: "Listar Backups", description: "Visualizar lista", module: "backups" },
    { code: "backups:create", name: "Criar Backups", description: "Criar novos", module: "backups" },
    { code: "backups:update", name: "Atualizar Backups", description: "Editar", module: "backups" },
    { code: "backups:delete", name: "Excluir Backups", description: "Excluir", module: "backups" },
    { code: "soap:execute", name: "Executar SOAP", description: "Executar chamadas SOAP", module: "soap" },
    { code: "soap:history", name: "Ver Histórico", description: "Visualizar histórico", module: "soap" },
    { code: "dashboard:view", name: "Ver Dashboard", description: "Visualizar dashboard", module: "dashboard" },
  ];

  for (const perm of permissionData) {
    await prisma.permission.create({ data: perm });
  }

  const permissions = await prisma.permission.findMany();
  for (const perm of permissions) {
    await prisma.rolePermission.create({
      data: { role: Role.ADMIN, permissionId: perm.id },
    });
  }

  console.log("✅ Permissions seeded");

  await prisma.appConfig.createMany({
    data: [
      { key: "app_name", value: "Integração TOTVS RM", type: "string", description: "Nome da aplicação" },
      { key: "soap_default_timeout", value: "30000", type: "number", description: "Timeout padrão SOAP (ms)" },
      { key: "soap_max_retries", value: "3", type: "number", description: "Máximo de tentativas" },
      { key: "maintenance_mode", value: "false", type: "boolean", description: "Modo de manutenção" },
    ],
  });

  console.log("✅ App config seeded");

  await prisma.featureFlag.createMany({
    data: [
      { code: "soap_builder", name: "Builder SOAP", active: true, roles: JSON.stringify([Role.ADMIN, Role.MANAGER]) },
      { code: "soap_history", name: "Histórico SOAP", active: true, roles: JSON.stringify([Role.ADMIN, Role.MANAGER, Role.USER]) },
      { code: "export_csv", name: "Exportação CSV", active: true, roles: JSON.stringify([Role.ADMIN, Role.MANAGER]) },
      { code: "dark_mode", name: "Modo Escuro", active: true, roles: JSON.stringify([Role.ADMIN, Role.MANAGER, Role.USER]) },
    ],
  });

  console.log("✅ Feature flags seeded");

  const endpointTypes = [
    { type: "dataserver", label: "Dataserver", suffix: "/dataserver", active: true },
    { type: "process", label: "Processo", suffix: "/process", active: true },
    { type: "consulta", label: "Consulta SQL", suffix: "/query", active: true },
    { type: "formula", label: "Fórmulas Visuais", suffix: "/formula", active: true },
    { type: "relatorio", label: "Relatórios", suffix: "/report", active: true },
  ] as const;

  const typeMethods: Record<string, { method: string; label: string; sortOrder: number }[]> = {
    dataserver: [
      { method: "GETSCHEMA", label: "Get Schema", sortOrder: 1 },
      { method: "READRECORD", label: "Read Record", sortOrder: 2 },
      { method: "READVIEW", label: "Read View", sortOrder: 3 },
      { method: "SAVERECORD", label: "Save Record", sortOrder: 4 },
      { method: "DELETERECORD", label: "Delete Record", sortOrder: 5 },
      { method: "ISVALIDDATASERVER", label: "Is Valid Dataserver", sortOrder: 6 },
    ],
    process: [
      { method: "GETSCHEMA2", label: "Get Schema 2", sortOrder: 1 },
      { method: "EXECUTEPROCESS", label: "Execute Process", sortOrder: 2 },
      { method: "EXECUTEWITHXMLPARAMS", label: "Execute With XML Params", sortOrder: 3 },
      { method: "EXECUTEWITHXMLPARAMSASYNC", label: "Execute Async", sortOrder: 4 },
      { method: "GETPROCESSSTATUS", label: "Get Process Status", sortOrder: 5 },
    ],
    consulta: [
      { method: "READVIEW", label: "Read View (Consulta)", sortOrder: 1 },
    ],
    formula: [
      { method: "EXECUTEPROCESS", label: "Execute Formula", sortOrder: 1 },
      { method: "GETSCHEMA", label: "Get Schema", sortOrder: 2 },
    ],
    relatorio: [
      { method: "EXECUTEPROCESS", label: "Execute Report", sortOrder: 1 },
      { method: "GETPROCESSSTATUS", label: "Check Report Status", sortOrder: 2 },
    ],
  };

  for (const et of endpointTypes) {
    const created = await prisma.soapEndpointType.create({ data: et });
    const methods = typeMethods[et.type] || [];
    for (const m of methods) {
      await prisma.soapEndpointMethod.create({
        data: { ...m, endpointTypeId: created.id },
      });
    }
  }

  console.log("✅ SOAP endpoint types and methods seeded");

  console.log("\n🎉 Seed completed!");
  console.log(`📧 Admin: admin@totvs.com.br / admin123`);
  console.log(`📧 Gerente: gerente@totvs.com.br / admin123`);
  console.log(`📧 Usuário: usuario@totvs.com.br / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
