import { PrismaClient, UserRoleLevel, SoapMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../config/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Order matters: children before parents, respecting FKs.
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.notificationSetting.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.demandTag.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.demand.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.demandType.deleteMany();
  await prisma.department.deleteMany();
  await prisma.requester.deleteMany();
  await prisma.clientContract.deleteMany();
  await prisma.analyst.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.appConfig.deleteMany();
  await prisma.soapFavorite.deleteMany();
  await prisma.soapTemplate.deleteMany();
  await prisma.soapLog.deleteMany();
  await prisma.soapEndpointMethod.deleteMany();
  await prisma.soapEndpointType.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.backup.deleteMany();
  await prisma.filter.deleteMany();
  await prisma.tbc.deleteMany();
  await prisma.sentence.deleteMany();
  await prisma.sentenceCategory.deleteMany();
  await prisma.client.deleteMany();
  await prisma.process.deleteMany();
  await prisma.dataserver.deleteMany();
  await prisma.totvsSystem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const organization = await prisma.organization.create({
    data: { name: "Empresa Padrão", slug: "default", plan: "free", status: true },
  });
  const orgId = organization.id;

  console.log("✅ Organization seeded");

  // ---------------------------------------------------------------------
  // RBAC: permissions catalog + default roles (admin/manager/user)
  // ---------------------------------------------------------------------
  const createdPermissions = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.create({
        data: { resource: p.resource, action: p.action, name: p.name, description: p.description, module: p.module },
      })
    )
  );
  const permissionByKey = new Map(createdPermissions.map((p) => [`${p.resource}:${p.action}`, p]));

  const roleDefs: { key: keyof typeof DEFAULT_ROLE_PERMISSIONS; name: string; description: string }[] = [
    { key: "ADMIN", name: "admin", description: "Acesso total ao sistema" },
    { key: "MANAGER", name: "manager", description: "Gestão operacional, sem exclusões destrutivas" },
    { key: "USER", name: "user", description: "Acesso de leitura e operações do dia a dia" },
  ];

  const roleByKey = new Map<string, { id: string }>();
  for (const def of roleDefs) {
    const role = await prisma.role.create({
      data: { organizationId: orgId, name: def.name, description: def.description, isSystem: true },
    });
    roleByKey.set(def.key, role);

    const keys = DEFAULT_ROLE_PERMISSIONS[def.key];
    await prisma.rolePermission.createMany({
      data: keys
        .map((k) => permissionByKey.get(k)?.id)
        .filter((id): id is string => !!id)
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }

  console.log("✅ Roles and permissions seeded");

  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Administrador",
      email: "admin@totvs.com.br",
      password: hashedPassword,
      role: UserRoleLevel.ADMIN,
      status: true,
      changePassword: false,
    },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: roleByKey.get("ADMIN")!.id } });

  const manager = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Gerente Geral",
      email: "gerente@totvs.com.br",
      password: hashedPassword,
      role: UserRoleLevel.MANAGER,
      status: true,
    },
  });
  await prisma.userRole.create({ data: { userId: manager.id, roleId: roleByKey.get("MANAGER")!.id } });

  const regularUser = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Usuário Teste",
      email: "usuario@totvs.com.br",
      password: hashedPassword,
      role: UserRoleLevel.USER,
      status: true,
    },
  });
  await prisma.userRole.create({ data: { userId: regularUser.id, roleId: roleByKey.get("USER")!.id } });

  console.log("✅ Users seeded");

  // ---------------------------------------------------------------------
  // TOTVS integration domain
  // ---------------------------------------------------------------------
  await prisma.dataserver.createMany({
    data: [
      { organizationId: orgId, code: "REST", name: "Dataserver REST", nameAlternative: "REST API" },
      { organizationId: orgId, code: "RM", name: "Dataserver RM", nameAlternative: "RM Principal" },
      { organizationId: orgId, code: "RMTHOMAS", name: "Dataserver RM Thomas", nameAlternative: "RM Thomas" },
      { organizationId: orgId, code: "RMGPE", name: "Dataserver RM GPE", nameAlternative: "RM GPE" },
      { organizationId: orgId, code: "RMAD", name: "Dataserver RM AD", nameAlternative: "RM Administrativo" },
      { organizationId: orgId, code: "RMCDC", name: "Dataserver RM CDC", nameAlternative: "RM CDC" },
    ],
  });

  console.log("✅ Dataservers seeded");

  await prisma.process.createMany({
    data: [
      { organizationId: orgId, code: "INTEGRACAO_CLIENTE", name: "Integração de Cliente", nameAlternative: "Sync Cliente" },
      { organizationId: orgId, code: "INTEGRACAO_CONTRATO", name: "Integração de Contrato", nameAlternative: "Sync Contrato" },
      { organizationId: orgId, code: "INTEGRACAO_FINANCEIRO", name: "Integração Financeira", nameAlternative: "Sync Financeiro" },
      { organizationId: orgId, code: "CONSULTA_ALUNO", name: "Consulta de Aluno", nameAlternative: "Query Aluno" },
      { organizationId: orgId, code: "CONSULTA_TURMA", name: "Consulta de Turma", nameAlternative: "Query Turma" },
      { organizationId: orgId, code: "LANCAMENTO_NOTA", name: "Lançamento de Nota", nameAlternative: "Nota Aluno" },
    ],
  });

  console.log("✅ Processes seeded");

  await prisma.totvsSystem.createMany({
    data: [
      { organizationId: orgId, code: "A", internalName: "RM Chronus", externalName: "Automação de Ponto" },
      { organizationId: orgId, code: "B", internalName: "RM Testis", externalName: "Avaliação e Pesquisa" },
      { organizationId: orgId, code: "C", internalName: "RM Saldus", externalName: "Gestão Contábil" },
      { organizationId: orgId, code: "D", internalName: "RM Liber", externalName: "Gestão Fiscal" },
      { organizationId: orgId, code: "E", internalName: "RM Classis", externalName: "Educacional" },
      { organizationId: orgId, code: "U", internalName: "RM Classis", externalName: "Educacional" },
      { organizationId: orgId, code: "F", internalName: "RM Fluxus", externalName: "Gestão Financeira" },
      { organizationId: orgId, code: "G", internalName: "RM Bis", externalName: "Inteligência de Negócios / Serviços Globais" },
      { organizationId: orgId, code: "H", internalName: "RM Agilis", externalName: "Aprovações e Atendimento" },
      { organizationId: orgId, code: "I", internalName: "RM Bonum", externalName: "Gestão Patrimonial" },
      { organizationId: orgId, code: "K", internalName: "RM Factor", externalName: "Planejamento e Controle de Produção" },
      { organizationId: orgId, code: "M", internalName: "RM Solum", externalName: "Obras e Projetos" },
      { organizationId: orgId, code: "N", internalName: "RM Officina", externalName: "Manutenção" },
      { organizationId: orgId, code: "P", internalName: "RM Labore", externalName: "Folha de Pagamento" },
      { organizationId: orgId, code: "T", internalName: "RM Nucleus", externalName: "Estoque, Compras e Faturamento" },
      { organizationId: orgId, code: "W", internalName: "RM PortalX", externalName: "Portal" },
      { organizationId: orgId, code: "X", internalName: "RM SGI", externalName: "Imobiliário" },
      { organizationId: orgId, code: "Y", internalName: "RM Acesso", externalName: "Controle de Acesso" },
    ],
  });

  console.log("✅ Sistemas TOTVS seeded");

  await prisma.client.createMany({
    data: [
      { organizationId: orgId, name: "Universidade Exemplo", linkCrm: "uni-exemplo", site: "https://exemplo.edu.br", status: true },
      { organizationId: orgId, name: "Colégio Modelo", linkCrm: "colegio-modelo", site: "https://colegiomodelo.com.br", status: true },
      { organizationId: orgId, name: "Escola Técnica Nacional", linkCrm: "etn", site: "https://etn.edu.br", status: true },
      { organizationId: orgId, name: "Faculdade Integrada", linkCrm: "faculdade-integrada", site: "https://facintegrada.edu.br", status: true },
    ],
  });

  console.log("✅ Clients seeded");

  const clients = await prisma.client.findMany();

  for (const client of clients) {
    await prisma.tbc.create({
      data: {
        organizationId: orgId,
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
        organizationId: orgId,
        tbcId: tbc.id,
        clientId: tbc.clientId,
        filter: "CODSENTENCA LIKE 'RB%'",
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
        organizationId: orgId,
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
    data: { organizationId: orgId, code: "MATRICULA", name: "Matrícula", status: true },
  });
  const catFinanceiro = await prisma.sentenceCategory.create({
    data: { organizationId: orgId, code: "FINANCEIRO", name: "Financeiro", status: true },
  });
  const catAcademico = await prisma.sentenceCategory.create({
    data: { organizationId: orgId, code: "ACADEMICO", name: "Acadêmico", status: true },
  });

  console.log("✅ Sentence Categories seeded");

  await prisma.sentence.createMany({
    data: [
      { organizationId: orgId, sentenceCategoryId: catMatricula.id, code: "REALIZAR_MATRICULA", name: "Realizar Matrícula", codSystem: "SISTEMA_PADRAO", status: true },
      { organizationId: orgId, sentenceCategoryId: catMatricula.id, code: "CANCELAR_MATRICULA", name: "Cancelar Matrícula", codSystem: "SISTEMA_PADRAO", status: true },
      { organizationId: orgId, sentenceCategoryId: catFinanceiro.id, code: "GERAR_BOLETO", name: "Gerar Boleto", codSystem: "SISTEMA_PADRAO", status: true },
      { organizationId: orgId, sentenceCategoryId: catFinanceiro.id, code: "BAIXAR_TITULO", name: "Baixar Título", codSystem: "SISTEMA_PADRAO", status: true },
      { organizationId: orgId, sentenceCategoryId: catAcademico.id, code: "LANCAR_NOTA", name: "Lançar Nota", codSystem: "SISTEMA_PADRAO", status: true },
      { organizationId: orgId, sentenceCategoryId: catAcademico.id, code: "CONSULTAR_HISTORICO", name: "Consultar Histórico", codSystem: "SISTEMA_PADRAO", status: true },
    ],
  });

  console.log("✅ Sentences seeded");

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
      { code: "soap_builder", name: "Builder SOAP", active: true, roles: JSON.stringify(["ADMIN", "MANAGER"]) },
      { code: "soap_history", name: "Histórico SOAP", active: true, roles: JSON.stringify(["ADMIN", "MANAGER", "USER"]) },
      { code: "export_csv", name: "Exportação CSV", active: true, roles: JSON.stringify(["ADMIN", "MANAGER"]) },
      { code: "dark_mode", name: "Modo Escuro", active: true, roles: JSON.stringify(["ADMIN", "MANAGER", "USER"]) },
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

  const typeMethods: Record<string, { method: SoapMethod; label: string; sortOrder: number }[]> = {
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
    consulta: [{ method: "READVIEW", label: "Read View (Consulta)", sortOrder: 1 }],
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
      await prisma.soapEndpointMethod.create({ data: { ...m, endpointTypeId: created.id } });
    }
  }

  console.log("✅ SOAP endpoint types and methods seeded");

  // ---------------------------------------------------------------------
  // Business domain (hours/demand tracking) -- light sample data
  // ---------------------------------------------------------------------
  const analyst = await prisma.analyst.create({
    data: { organizationId: orgId, userId: regularUser.id, name: "Usuário Teste", email: "usuario@totvs.com.br", role: "Analista", level: 1 },
  });

  const demandClient = await prisma.client.create({
    data: { organizationId: orgId, name: "Cliente Demandas Exemplo", email: "contato@clienteexemplo.com.br", status: true },
  });

  await prisma.clientContract.create({
    data: { clientId: demandClient.id, contractedHours: 40, hourlyRate: 150, startDate: new Date(), status: "ACTIVE" },
  });

  const requester = await prisma.requester.create({
    data: { organizationId: orgId, name: "Solicitante Padrão", email: "solicitante@clienteexemplo.com.br", status: true },
  });

  const department = await prisma.department.create({
    data: { organizationId: orgId, name: "Suporte", description: "Time de suporte e integração" },
  });

  const demandType = await prisma.demandType.create({
    data: { organizationId: orgId, name: "Integração", description: "Demandas de integração TOTVS", color: "#a855f7" },
  });

  const tag = await prisma.tag.create({ data: { organizationId: orgId, name: "urgente", color: "#ef4444" } });

  const demand = await prisma.demand.create({
    data: {
      organizationId: orgId,
      name: "Configurar filtro de sentença",
      description: "Configurar e validar o filtro CODSENTENCA LIKE 'RB%' para o cliente exemplo",
      date: new Date(),
      durationMinutes: 60,
      priority: "MEDIUM",
      status: "PENDING",
      analystId: analyst.id,
      clientId: demandClient.id,
      requesterId: requester.id,
      departmentId: department.id,
      demandTypeId: demandType.id,
    },
  });
  await prisma.demandTag.create({ data: { demandId: demand.id, tagId: tag.id } });

  console.log("✅ Business domain (demands) sample data seeded");

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
