import { PrismaClient, SoapMethod, UserRoleLevel } from "@prisma/client"
import bcrypt from "bcryptjs"
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../config/permissions"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // Order matters: children before parents, respecting FKs.
  await prisma.userRole.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.role.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.notificationSetting.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.demandTag.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.demand.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.demandType.deleteMany()
  await prisma.department.deleteMany()
  await prisma.requester.deleteMany()
  await prisma.clientContract.deleteMany()
  await prisma.analyst.deleteMany()
  await prisma.featureFlag.deleteMany()
  await prisma.appConfig.deleteMany()
  await prisma.soapFavorite.deleteMany()
  await prisma.soapTemplate.deleteMany()
  await prisma.soapLog.deleteMany()
  await prisma.soapEndpointMethod.deleteMany()
  await prisma.soapEndpointType.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.backup.deleteMany()
  await prisma.backupRun.deleteMany()
  await prisma.filter.deleteMany()
  await prisma.tbc.deleteMany()
  await prisma.sentence.deleteMany()
  await prisma.sentenceCategory.deleteMany()
  await prisma.client.deleteMany()
  await prisma.process.deleteMany()
  await prisma.dataserver.deleteMany()
  await prisma.totvsSystem.deleteMany()
  await prisma.user.deleteMany()
  await prisma.emailSettings.deleteMany()
  await prisma.organization.deleteMany()

  const organization = await prisma.organization.create({
    data: { name: "Empresa Padrão", slug: "default", plan: "free", status: true },
  })
  const orgId = organization.id

  console.log("✅ Organization seeded")

  // ---------------------------------------------------------------------
  // RBAC: permissions catalog + default roles (admin/manager/user)
  // ---------------------------------------------------------------------
  const createdPermissions = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.create({
        data: { resource: p.resource, action: p.action, name: p.name, description: p.description, module: p.module },
      })
    )
  )
  const permissionByKey = new Map(createdPermissions.map((p) => [`${p.resource}:${p.action}`, p]))

  const roleDefs: { key: keyof typeof DEFAULT_ROLE_PERMISSIONS; name: string; description: string }[] = [
    { key: "ADMIN", name: "admin", description: "Acesso total ao sistema" },
    { key: "MANAGER", name: "manager", description: "Gestão operacional, sem exclusões destrutivas" },
    { key: "USER", name: "user", description: "Acesso de leitura e operações do dia a dia" },
  ]

  const roleByKey = new Map<string, { id: string }>()
  for (const def of roleDefs) {
    const role = await prisma.role.create({
      data: { organizationId: orgId, name: def.name, description: def.description, isSystem: true },
    })
    roleByKey.set(def.key, role)

    const keys = DEFAULT_ROLE_PERMISSIONS[def.key]
    await prisma.rolePermission.createMany({
      data: keys
        .map((k) => permissionByKey.get(k)?.id)
        .filter((id): id is string => !!id)
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    })
  }

  console.log("✅ Roles and permissions seeded")

  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------
  const hashedPassword = await bcrypt.hash("admin123", 12)

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
  })
  await prisma.userRole.create({ data: { userId: admin.id, roleId: roleByKey.get("ADMIN")!.id } })

  const manager = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Gerente Geral",
      email: "gerente@totvs.com.br",
      password: hashedPassword,
      role: UserRoleLevel.MANAGER,
      status: true,
    },
  })
  await prisma.userRole.create({ data: { userId: manager.id, roleId: roleByKey.get("MANAGER")!.id } })

  const regularUser = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Usuário Teste",
      email: "usuario@totvs.com.br",
      password: hashedPassword,
      role: UserRoleLevel.USER,
      status: true,
    },
  })
  await prisma.userRole.create({ data: { userId: regularUser.id, roleId: roleByKey.get("USER")!.id } })

  console.log("✅ Users seeded")

  // ---------------------------------------------------------------------
  // TOTVS integration domain
  // ---------------------------------------------------------------------
  await prisma.dataserver.createMany({
    data: [
      {
        organizationId: orgId,
        code: "CRMAtendimentoArquivosAnexosData",
        name: "Anexos de Atendimento CRM",
        nameAlternative: "CRMAtendimentoArquivosAnexos",
      },
      {
        organizationId: orgId,
        code: "CRMAtendimentoExtData",
        name: "Atendimento CRM (Extensão)",
        nameAlternative: "CRMAtendimentoExt",
      },
      {
        organizationId: orgId,
        code: "CstDiversidadeInclusaoAnexoData",
        name: "Anexo de Diversidade e Inclusão",
        nameAlternative: "CstDiversidadeInclusaoAnexo",
      },
      { organizationId: orgId, code: "EduAlunoData", name: "Aluno (Educacional)", nameAlternative: "EduAluno" },
      { organizationId: orgId, code: "EduBolsaAlunoData", name: "Bolsa do Aluno", nameAlternative: "EduBolsaAluno" },
      { organizationId: orgId, code: "EduContratoData", name: "Contrato Educacional", nameAlternative: "EduContrato" },
      { organizationId: orgId, code: "EduDocAlunoData", name: "Documento do Aluno", nameAlternative: "EduDocAluno" },
      { organizationId: orgId, code: "EduDocFiadorData", name: "Documento do Fiador", nameAlternative: "EduDocFiador" },
      { organizationId: orgId, code: "EduFiadorData", name: "Fiador", nameAlternative: "EduFiador" },
      {
        organizationId: orgId,
        code: "EduFichaMedicaAlunoData",
        name: "Ficha Médica do Aluno",
        nameAlternative: "EduFichaMedicaAluno",
      },
      {
        organizationId: orgId,
        code: "EduHabilitacaoAlunoData",
        name: "Habilitação do Aluno",
        nameAlternative: "EduHabilitacaoAluno",
      },
      {
        organizationId: orgId,
        code: "EduHistDiscFacData",
        name: "Histórico de Disciplina/Faculdade",
        nameAlternative: "EduHistDiscFac",
      },
      {
        organizationId: orgId,
        code: "EduHistDiscFacExtData",
        name: "Histórico de Disciplina/Faculdade (Extensão)",
        nameAlternative: "EduHistDiscFacExt",
      },
      {
        organizationId: orgId,
        code: "EduInscAlunoAtvOfertadaData",
        name: "Inscrição do Aluno em Atividade Ofertada",
        nameAlternative: "EduInscAlunoAtvOfertada",
      },
      {
        organizationId: orgId,
        code: "EduMatricPLData",
        name: "Matrícula (Plano de Ensino)",
        nameAlternative: "EduMatricPL",
      },
      { organizationId: orgId, code: "EduParcelaData", name: "Parcela Educacional", nameAlternative: "EduParcela" },
      {
        organizationId: orgId,
        code: "EduPSDocumentoEntregueData",
        name: "Documento Entregue (Processo Seletivo)",
        nameAlternative: "EduPSDocumentoEntregue",
      },
      {
        organizationId: orgId,
        code: "EduPSInscricaoAreaOfertadaData",
        name: "Inscrição em Área Ofertada (PS)",
        nameAlternative: "EduPSInscricaoAreaOfertada",
      },
      {
        organizationId: orgId,
        code: "EduPSInscricaoUsuarioAreaData",
        name: "Inscrição de Usuário por Área (PS)",
        nameAlternative: "EduPSInscricaoUsuarioArea",
      },
      {
        organizationId: orgId,
        code: "EduPSLocalEtapaInscritoData",
        name: "Local de Etapa do Inscrito (PS)",
        nameAlternative: "EduPSLocalEtapaInscrito",
      },
      {
        organizationId: orgId,
        code: "EduPSRecursoData",
        name: "Recurso (Processo Seletivo)",
        nameAlternative: "EduPSRecurso",
      },
      {
        organizationId: orgId,
        code: "EduPSUsuarioData",
        name: "Usuário (Processo Seletivo)",
        nameAlternative: "EduPSUsuario",
      },
      {
        organizationId: orgId,
        code: "EduPSUsuarioTipoRelacData",
        name: "Tipo de Relacionamento do Usuário (PS)",
        nameAlternative: "EduPSUsuarioTipoRelac",
      },
      {
        organizationId: orgId,
        code: "EduResponsavelAlunoData",
        name: "Responsável pelo Aluno",
        nameAlternative: "EduResponsavelAluno",
      },
      { organizationId: orgId, code: "EduTCCBancaData", name: "Banca de TCC", nameAlternative: "EduTCCBanca" },
      { organizationId: orgId, code: "EduTCCData", name: "TCC", nameAlternative: "EduTCC" },
      {
        organizationId: orgId,
        code: "EduTCCMatAlunoData",
        name: "Matrícula do Aluno em TCC",
        nameAlternative: "EduTCCMatAluno",
      },
      {
        organizationId: orgId,
        code: "EduTCCOrientadorData",
        name: "Orientador de TCC",
        nameAlternative: "EduTCCOrientador",
      },
      {
        organizationId: orgId,
        code: "EduTCCParticipantesBancaData",
        name: "Participantes da Banca de TCC",
        nameAlternative: "EduTCCParticipantesBanca",
      },
      { organizationId: orgId, code: "EduCampusData", name: "Campus", nameAlternative: "EduCampus" },
      { organizationId: orgId, code: "EduCursoData", name: "Curso", nameAlternative: "EduCurso" },
      { organizationId: orgId, code: "EduGradeData", name: "Grade Curricular", nameAlternative: "EduGrade" },
      {
        organizationId: orgId,
        code: "EduGradeAlunoData",
        name: "Grade Curricular do Aluno",
        nameAlternative: "EduGradeAluno",
      },
      { organizationId: orgId, code: "EduTipoCursoData", name: "Tipo de Curso", nameAlternative: "EduTipoCurso" },
      {
        organizationId: orgId,
        code: "EduHabilitacaoFilialCampusData",
        name: "Habilitação por Filial/Campus",
        nameAlternative: "EduHabilitacaoFilialCampus",
      },
      { organizationId: orgId, code: "EduDisciplinaData", name: "Disciplina", nameAlternative: "EduDisciplina" },
      { organizationId: orgId, code: "EduPLetivoData", name: "Período Letivo", nameAlternative: "EduPLetivo" },
      { organizationId: orgId, code: "EduTurnoData", name: "Turno", nameAlternative: "EduTurno" },
      {
        organizationId: orgId,
        code: "EduDocExigidosData",
        name: "Documentos Exigidos",
        nameAlternative: "EduDocExigidos",
      },
      {
        organizationId: orgId,
        code: "EduDocumentosExigidosFiadorData",
        name: "Documentos Exigidos do Fiador",
        nameAlternative: "EduDocumentosExigidosFiador",
      },
      {
        organizationId: orgId,
        code: "EduParcPlanoData",
        name: "Plano de Parcelamento",
        nameAlternative: "EduParcPlano",
      },
      {
        organizationId: orgId,
        code: "EduPSAtividadeAgendadaData",
        name: "Atividade Agendada (PS)",
        nameAlternative: "EduPSAtividadeAgendada",
      },
      {
        organizationId: orgId,
        code: "EduPSCampusData",
        name: "Campus (Processo Seletivo)",
        nameAlternative: "EduPSCampus",
      },
      {
        organizationId: orgId,
        code: "EduPSCategoriaProcSelData",
        name: "Categoria do Processo Seletivo",
        nameAlternative: "EduPSCategoriaProcSel",
      },
      {
        organizationId: orgId,
        code: "EduPSFormaInscricaoPSData",
        name: "Forma de Inscrição (PS)",
        nameAlternative: "EduPSFormaInscricaoPS",
      },
      {
        organizationId: orgId,
        code: "EduPSPredioData",
        name: "Prédio (Processo Seletivo)",
        nameAlternative: "EduPSPredio",
      },
      {
        organizationId: orgId,
        code: "EduPSProcessoSeletivoData",
        name: "Processo Seletivo",
        nameAlternative: "EduPSProcessoSeletivo",
      },
      {
        organizationId: orgId,
        code: "EduPSAreaOfertadaData",
        name: "Área de Ofertada (PS)",
        nameAlternative: "EduPSAreaOfertada",
      },
      {
        organizationId: orgId,
        code: "EduPSRecursoData",
        name: "Recurso",
        nameAlternative: "EduPSRecurso",
      },
      {
        organizationId: orgId,
        code: "EduPSAgendamentosData",
        name: "Agendamentos (Processo Seletivo)",
        nameAlternative: "EduPSAgendamentos",
      },
      {
        organizationId: orgId,
        code: "EduPSAreaInteresseData",
        name: "Área de Interesse (PS)",
        nameAlternative: "EduPSAreaInteresse",
      },
      {
        organizationId: orgId,
        code: "EduPSConcursoBolsaData",
        name: "Concurso de Bolsa (PS)",
        nameAlternative: "EduPSConcursoBolsa",
      },
      { organizationId: orgId, code: "RptReportsData", name: "Relatórios (RPT)", nameAlternative: "RptReports" },
      {
        organizationId: orgId,
        code: "FinCFOContatoDataBR",
        name: "Contato do CFO (BR)",
        nameAlternative: "FinCFOContatoBR",
      },
      { organizationId: orgId, code: "FinCFODataBR", name: "CFO (BR)", nameAlternative: "FinCFOBR" },
      { organizationId: orgId, code: "FinLanDataBR", name: "Lançamento Financeiro (BR)", nameAlternative: "FinLanBR" },
      { organizationId: orgId, code: "GlbConsSQLData", name: "Consulta SQL (Global)", nameAlternative: "GlbConsSQL" },
      { organizationId: orgId, code: "GlbWorkflowData", name: "Workflow (Global)", nameAlternative: "GlbWorkflow" },
      { organizationId: orgId, code: "GlbUsuarioData", name: "Usuário (Global)", nameAlternative: "GlbUsuario" },
      { organizationId: orgId, code: "GlbPerfilData", name: "Perfil (Global)", nameAlternative: "GlbPerfil" },
      {
        organizationId: orgId,
        code: "GlbAtributoTipoData",
        name: "Tipo de Atributo (Global)",
        nameAlternative: "GlbAtributoTipo",
      },
      { organizationId: orgId, code: "GlbTabelaData", name: "Tabela (Global)", nameAlternative: "GlbTabela" },
      {
        organizationId: orgId,
        code: "GlbRelacionamentoData",
        name: "Relacionamento (Global)",
        nameAlternative: "GlbRelacionamento",
      },
      {
        organizationId: orgId,
        code: "GlbMdNegocioData",
        name: "Modelo de Negócio (Global)",
        nameAlternative: "GlbMdNegocio",
      },
      {
        organizationId: orgId,
        code: "GlbApresentacaoData",
        name: "Apresentação (Global)",
        nameAlternative: "GlbApresentacao",
      },
      { organizationId: orgId, code: "GlbProjetoData", name: "Projeto (Global)", nameAlternative: "GlbProjeto" },
      { organizationId: orgId, code: "RhuFiliacaoData", name: "Filiação (RH)", nameAlternative: "RhuFiliacao" },
      { organizationId: orgId, code: "RhuPessoaData", name: "Pessoa (RH)", nameAlternative: "RhuPessoa" },
    ],
  })

  console.log("✅ Dataservers seeded")

  await prisma.process.createMany({
    data: [
      {
        organizationId: orgId,
        code: "EduAtendAlunoData",
        name: "Atendimento ao Aluno",
        nameAlternative: "EduAtendAluno",
      },
      {
        organizationId: orgId,
        code: "EduAtualizaRespFinData",
        name: "Atualização de Responsável Financeiro",
        nameAlternative: "EduAtualizaRespFin",
      },
      {
        organizationId: orgId,
        code: "EduGerarLancFromParcelaData",
        name: "Gerar Lançamento a partir de Parcela",
        nameAlternative: "EduGerarLancFromParcela",
      },
      {
        organizationId: orgId,
        code: "EduMatricAprovadosPSData",
        name: "Matrícula de Aprovados (Processo Seletivo)",
        nameAlternative: "EduMatricAprovadosPS",
      },
      {
        organizationId: orgId,
        code: "EduMatricProcData",
        name: "Processo de Matrícula",
        nameAlternative: "EduMatricProc",
      },
      {
        organizationId: orgId,
        code: "EduMudancaStatusData",
        name: "Mudança de Status",
        nameAlternative: "EduMudancaStatus",
      },
      {
        organizationId: orgId,
        code: "EduPSAlteraFormalInscricaoData",
        name: "Altera Formalização de Inscrição (PS)",
        nameAlternative: "EduPSAlteraFormalInscricao",
      },
      {
        organizationId: orgId,
        code: "EduPSAlteraStatusOpcaoData",
        name: "Altera Status de Opção (PS)",
        nameAlternative: "EduPSAlteraStatusOpcao",
      },
      {
        organizationId: orgId,
        code: "EduPSCancelaDistribuicaoCadernoProvaData",
        name: "Cancela Distribuição de Caderno de Prova (PS)",
        nameAlternative: "EduPSCancelaDistribuicaoCadernoProva",
      },
      {
        organizationId: orgId,
        code: "EduPSCancelaInscricaoData",
        name: "Cancela Inscrição (PS)",
        nameAlternative: "EduPSCancelaInscricao",
      },
      {
        organizationId: orgId,
        code: "EduPSChamadaCandidatosData",
        name: "Chamada de Candidatos (PS)",
        nameAlternative: "EduPSChamadaCandidatos",
      },
      {
        organizationId: orgId,
        code: "EduPSClassificaCandidatosData",
        name: "Classifica Candidatos (PS)",
        nameAlternative: "EduPSClassificaCandidatos",
      },
      {
        organizationId: orgId,
        code: "EduPSConfirmaInscricaoData",
        name: "Confirma Inscrição (PS)",
        nameAlternative: "EduPSConfirmaInscricao",
      },
      {
        organizationId: orgId,
        code: "EduPSDistribuicaoCadernoProvaData",
        name: "Distribuição de Caderno de Prova (PS)",
        nameAlternative: "EduPSDistribuicaoCadernoProva",
      },
      {
        organizationId: orgId,
        code: "EduTotvsSignContratoSliceableProcData",
        name: "Assinatura de Contrato via TOTVS Sign",
        nameAlternative: "EduTotvsSignContratoSliceableProc",
      },
      {
        organizationId: orgId,
        code: "FinAcordoGeracaoProcData",
        name: "Geração de Acordo Financeiro",
        nameAlternative: "FinAcordoGeracaoProc",
      },
      {
        organizationId: orgId,
        code: "FinBoletoCancelamentoData",
        name: "Cancelamento de Boleto",
        nameAlternative: "FinBoletoCancelamento",
      },
      {
        organizationId: orgId,
        code: "FinBoletoInclusaoData",
        name: "Inclusão de Boleto",
        nameAlternative: "FinBoletoInclusao",
      },
      {
        organizationId: orgId,
        code: "FinBoletoRegistroOnLineDataProc",
        name: "Registro Online de Boleto",
        nameAlternative: "FinBoletoRegistroOnLine",
      },
      {
        organizationId: orgId,
        code: "FinCancelamentoRemessaBoletoDataProcess",
        name: "Cancelamento de Remessa de Boleto",
        nameAlternative: "FinCancelamentoRemessaBoleto",
      },
      {
        organizationId: orgId,
        code: "FinGeraCliForPessoaServer",
        name: "Geração de Cliente/Fornecedor a partir de Pessoa",
        nameAlternative: "FinGeraCliForPessoa",
      },
      {
        organizationId: orgId,
        code: "FinLanBaixaTBCData",
        name: "Baixa de Lançamento (TBC)",
        nameAlternative: "FinLanBaixaTBC",
      },
      {
        organizationId: orgId,
        code: "FinLanCancelamentoData",
        name: "Cancelamento de Lançamento",
        nameAlternative: "FinLanCancelamento",
      },
      {
        organizationId: orgId,
        code: "GlbWorkflowExecProc",
        name: "Execução de Workflow",
        nameAlternative: "GlbWorkflowExec",
      },
    ],
  })

  console.log("✅ Processes seeded")

  await prisma.totvsSystem.createMany({
    data: [
      { organizationId: orgId, code: "A", internalName: "RM Chronus", externalName: "Automação de Ponto" },
      { organizationId: orgId, code: "B", internalName: "RM Testis", externalName: "Avaliação e Pesquisa" },
      { organizationId: orgId, code: "C", internalName: "RM Saldus", externalName: "Gestão Contábil" },
      { organizationId: orgId, code: "D", internalName: "RM Liber", externalName: "Gestão Fiscal" },
      { organizationId: orgId, code: "E", internalName: "RM Classis", externalName: "Educacional" },
      { organizationId: orgId, code: "F", internalName: "RM Fluxus", externalName: "Gestão Financeira" },
      {
        organizationId: orgId,
        code: "G",
        internalName: "RM Bis",
        externalName: "Inteligência de Negócios / Serviços Globais",
      },
      { organizationId: orgId, code: "H", internalName: "RM Agilis", externalName: "Aprovações e Atendimento" },
      { organizationId: orgId, code: "I", internalName: "RM Bonum", externalName: "Gestão Patrimonial" },
      {
        organizationId: orgId,
        code: "K",
        internalName: "RM Factor",
        externalName: "Planejamento e Controle de Produção",
      },
      { organizationId: orgId, code: "M", internalName: "RM Solum", externalName: "Obras e Projetos" },
      { organizationId: orgId, code: "N", internalName: "RM Officina", externalName: "Manutenção" },
      { organizationId: orgId, code: "P", internalName: "RM Labore", externalName: "Folha de Pagamento" },
      { organizationId: orgId, code: "S", internalName: "RM Classis .Net", externalName: "TOTVS Educacional" },
      { organizationId: orgId, code: "T", internalName: "RM Nucleus", externalName: "Estoque, Compras e Faturamento" },
      { organizationId: orgId, code: "U", internalName: "RM Classis", externalName: "Educacional" },
      { organizationId: orgId, code: "V", internalName: "RM Vitae", externalName: "TOTVS Recursos Humanos" },
      { organizationId: orgId, code: "W", internalName: "RM PortalX", externalName: "Portal" },
      { organizationId: orgId, code: "X", internalName: "RM SGI", externalName: "Imobiliário" },
      { organizationId: orgId, code: "Y", internalName: "RM Acesso", externalName: "Controle de Acesso" },
    ],
  })

  console.log("✅ Sistemas TOTVS seeded")

  await prisma.client.createMany({
    data: [
      {
        organizationId: orgId,
        name: "SENAI - Base Modelo",
        linkCrm: "https://crmbasemodelosenairegionais.apprubeus.com.br/",
        site: "https://exemplo.edu.br",
        status: true,
      },
      {
        organizationId: orgId,
        name: "ITE - Toledo",
        linkCrm: "https://crmtoledo.apprubeus.com.br/",
        site: "https://colegiomodelo.com.br",
        status: true,
      },
    ],
  })

  console.log("✅ Clients seeded")

  const clients = await prisma.client.findMany()

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
    })
  }

  console.log("✅ TBCs seeded")

  const tbcs = await prisma.tbc.findMany()

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
        codSystemContext: "S",
        userContext: "tiago.persch",
        codColigadaSentenca: "0",
        codSistemaSentenca: "S",
        status: true,
      },
    })
  }

  console.log("✅ Filters seeded")

  // Backups and Sentences are intentionally left empty here: a Backup row is a snapshot of a
  // live TOTVS sentence pulled by the app's own "Realizar Backup" flow (see
  // services/rm-sentence.service.ts / services/backup.service.ts), scoped strictly to its
  // filterId — not test/placeholder data. Seeding a fake "BACKUP_PADRAO" row per filter here
  // used to make every filter's backup list start non-empty with data no real backup run ever
  // produced; removed so each filter's list only ever shows what its own backup runs fetched.

  await prisma.appConfig.createMany({
    data: [
      { key: "app_name", value: "Integração TOTVS RM", type: "string", description: "Nome da aplicação" },
      { key: "soap_default_timeout", value: "30000", type: "number", description: "Timeout padrão SOAP (ms)" },
      { key: "soap_max_retries", value: "3", type: "number", description: "Máximo de tentativas" },
      { key: "maintenance_mode", value: "false", type: "boolean", description: "Modo de manutenção" },
    ],
  })

  console.log("✅ App config seeded")

  await prisma.featureFlag.createMany({
    data: [
      { code: "soap_builder", name: "Builder SOAP", active: true, roles: JSON.stringify(["ADMIN", "MANAGER"]) },
      {
        code: "soap_history",
        name: "Histórico SOAP",
        active: true,
        roles: JSON.stringify(["ADMIN", "MANAGER", "USER"]),
      },
      { code: "export_csv", name: "Exportação CSV", active: true, roles: JSON.stringify(["ADMIN", "MANAGER"]) },
      { code: "dark_mode", name: "Modo Escuro", active: true, roles: JSON.stringify(["ADMIN", "MANAGER", "USER"]) },
    ],
  })

  console.log("✅ Feature flags seeded")

  // suffix stores the real TOTVS RM webservice folder name (verified live against each
  // service's own MEX WSDL) — soap.service.ts appends "EduLicense" in front of it when the
  // TBC's "não consumir licença" flag is set, and the port interface after it.
  const endpointTypes = [
    { type: "dataserver", label: "Dataserver", suffix: "wsDataServer", active: true },
    { type: "process", label: "Processo", suffix: "wsProcess", active: true },
    { type: "consulta", label: "Consulta SQL", suffix: "wsConsultaSQL", active: true },
    { type: "formula", label: "Fórmulas Visuais", suffix: "wsFormulaVisual", active: true },
    { type: "relatorio", label: "Relatórios", suffix: "wsReport", active: true },
  ] as const

  const typeMethods: Record<string, { method: SoapMethod; label: string; sortOrder: number }[]> = {
    dataserver: [
      { method: "AUTENTICAACESSO", label: "Autentica acesso", sortOrder: 0 },
      { method: "CHECKSERVICEACTIVITY", label: "Verifica atividade do serviço", sortOrder: 1 },
      { method: "GETSCHEMA", label: "Busca todo o esquema", sortOrder: 2 },
      { method: "READRECORD", label: "Ler registro", sortOrder: 3 },
      { method: "READVIEW", label: "Ler visão", sortOrder: 4 },
      { method: "SAVERECORD", label: "Salva registro", sortOrder: 5 },
      { method: "DELETERECORD", label: "Excluir registro", sortOrder: 6 },
      { method: "DELETERECORDBYKEY", label: "Excluir registro por chave primária", sortOrder: 8 },
      { method: "ISVALIDDATASERVER", label: "Verifica se o dataserver é válido", sortOrder: 9 },
    ],
    process: [
      { method: "AUTENTICAACESSO", label: "Autentica acesso", sortOrder: 0 },
      { method: "CHECKSERVICEACTIVITY", label: "Verifica atividade do serviço", sortOrder: 1 },
      { method: "GETSCHEMA", label: "Busca todo o esquema", sortOrder: 2 },
      { method: "EXECUTEWITHXMLPARAMS", label: "Executa o processo com parâmetros XML", sortOrder: 3 },
      { method: "EXECUTEWITHXMLPARAMSASYNC", label: "Executar Com Parâmetros Xml De Forma Assíncrona", sortOrder: 4 },
      { method: "GETPROCESSSTATUS", label: "Busca status do processo", sortOrder: 5 },
    ],
    consulta: [
      { method: "AUTENTICAACESSO", label: "Autentica acesso", sortOrder: 0 },
      { method: "CHECKSERVICEACTIVITY", label: "Verifica atividade do serviço", sortOrder: 1 },
      { method: "REALIZARCONSULTASQL", label: "Realizar Consulta SQL", sortOrder: 2 },
      { method: "REALIZARCONSULTASQLCONTEXTO", label: "Realizar Consulta SQL com Contexto", sortOrder: 3 },
    ],
    formula: [
      { method: "AUTENTICAACESSO", label: "Autentica acesso", sortOrder: 0 },
      { method: "CHECKSERVICEACTIVITY", label: "Verifica atividade do serviço", sortOrder: 1 },
      { method: "GETPARAMETERS", label: "Busca todo o esquema", sortOrder: 2 },
      { method: "EXECUTE", label: "Executar Fórmula", sortOrder: 3 },
    ],
    relatorio: [
      { method: "AUTENTICAACESSO", label: "Autentica acesso", sortOrder: 0 },
      { method: "CHECKSERVICEACTIVITY", label: "Verifica atividade do serviço", sortOrder: 1 },
      { method: "GETREPORTLIST", label: "Listar relatórios disponíveis", sortOrder: 2 },
      { method: "GETREPORTMETADATA", label: "Buscar metadados do relatório", sortOrder: 3 },
      { method: "GETREPORTINFO", label: "Buscar filtros e parâmetros do relatório", sortOrder: 4 },
      { method: "GENERATEREPORT", label: "Gerar relatório (síncrono)", sortOrder: 5 },
      { method: "GENERATEREPORTASYNCHRONOUS", label: "Gerar relatório de forma assíncrona", sortOrder: 6 },
      { method: "GETGENERATEDREPORTSTATUS", label: "Verificar status do relatório gerado", sortOrder: 7 },
      { method: "GETGENERATEDREPORTSIZE", label: "Buscar tamanho do arquivo gerado", sortOrder: 8 },
      { method: "GETFILECHUNK", label: "Buscar bloco do arquivo gerado", sortOrder: 9 },
    ],
  }

  for (const et of endpointTypes) {
    const created = await prisma.soapEndpointType.create({ data: et })
    const methods = typeMethods[et.type] || []
    for (const m of methods) {
      await prisma.soapEndpointMethod.create({ data: { ...m, endpointTypeId: created.id } })
    }
  }

  console.log("✅ SOAP endpoint types and methods seeded")

  // ---------------------------------------------------------------------
  // Business domain (hours/demand tracking) -- light sample data
  // ---------------------------------------------------------------------
  const analyst = await prisma.analyst.create({
    data: {
      organizationId: orgId,
      userId: regularUser.id,
      name: "Usuário Teste",
      email: "usuario@totvs.com.br",
      role: "Analista",
      level: 1,
    },
  })

  const demandClient = await prisma.client.create({
    data: {
      organizationId: orgId,
      name: "Cliente Demandas Exemplo",
      email: "contato@clienteexemplo.com.br",
      status: true,
    },
  })

  await prisma.clientContract.create({
    data: { clientId: demandClient.id, contractedHours: 40, hourlyRate: 150, startDate: new Date(), status: "ACTIVE" },
  })

  const requester = await prisma.requester.create({
    data: {
      organizationId: orgId,
      name: "Solicitante Padrão",
      email: "solicitante@clienteexemplo.com.br",
      status: true,
    },
  })

  const department = await prisma.department.create({
    data: { organizationId: orgId, name: "Suporte", description: "Time de suporte e integração" },
  })

  const demandType = await prisma.demandType.create({
    data: { organizationId: orgId, name: "Integração", description: "Demandas de integração TOTVS", color: "#a855f7" },
  })

  const tag = await prisma.tag.create({ data: { organizationId: orgId, name: "urgente", color: "#ef4444" } })

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
  })
  await prisma.demandTag.create({ data: { demandId: demand.id, tagId: tag.id } })

  console.log("✅ Business domain (demands) sample data seeded")

  console.log("\n🎉 Seed completed!")
  console.log(`📧 Admin: admin@totvs.com.br / admin123`)
  console.log(`📧 Gerente: gerente@totvs.com.br / admin123`)
  console.log(`📧 Usuário: usuario@totvs.com.br / admin123`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
