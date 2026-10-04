import type { ChecklistTableMeta } from "@/actions/integrations/tbc-checklist"

/** A block of one screen tab: a table's listed fields (`fields`), or — without `fields` — the whole
 *  table, every row (meant for child tables like documentos exigidos / etapas). */
export type LayoutSection = {
  title?: string
  table: string
  fields?: string[]
}

export type LayoutTab = {
  name: string
  sections: LayoutSection[]
}

export const OTHERS_TAB_NAME = "Outros campos"

/**
 * Mirrors the tabs of TOTVS RM's own registration screen for a Data Server, so the checklist reads
 * like the screen the analyst configures. Processo Seletivo: built from the RM "Processo seletivo"
 * screen (Identificação, Informações complementares, Calendário, Portaria, Informações financeiras,
 * E-mails, Parâmetros, Venda online de cursos, Forma de inscrição, Campos complementares). Área
 * Ofertada: built from the RM "Área de interesse ofertada" screen
 * (Identificação, Informações complementares, Inf. financeiras, Termo de aceite, Distribuir prova,
 * Matrícula — with its Acadêmico/Financeiro/Perfil do usuário/Alteração de dados sub-tabs —,
 * Documento exigido, Idioma ofertado, Etapas) and the field names of the real GetSchema. Fields /
 * tables left out of the config are never hidden: `buildLayoutTabs` puts them in extra tabs.
 */
export const CHECKLIST_LAYOUTS: Record<string, LayoutTab[]> = {
  EduPSProcessoSeletivoData: [
    {
      name: "Identificação",
      sections: [
        {
          title: "Identificação",
          table: "SPSProcessoSeletivo",
          fields: [
            "STATUS",
            "IDPS",
            "NOME",
            "CODINST",
            "NOMEINSTITUICAO",
            "NOMEARQUIVOEDITAL",
            "ARQUIVOEDITAL",
            "IDCATEGORIAPS",
            "OFERTAONLINE",
            "CODFILIAL",
          ],
        },
        {
          title: "Inscrições",
          table: "SPSProcessoSeletivo",
          fields: [
            "VALORINSCRICAO",
            "LIMITEINSCRICOES",
            "ACEITATREINEIRO",
            "NECESSIDADESESPECIAIS",
            "EXIBENOPORTAL",
            "VISIVELTODASFILIAIS",
            "LOGSTATUSOPCAO",
          ],
        },
      ],
    },
    {
      name: "Informações complementares",
      sections: [
        {
          title: "Vagas e alocação",
          table: "SPSProcessoSeletivo",
          fields: ["TIPOENSALAMENTO", "CONTROLEVAGAS", "TIPOCONTROLEVAGAS", "LIMITECANCELAMENTOAREA"],
        },
        {
          title: "Questionário",
          table: "SPSProcessoSeletivo",
          fields: ["CODCOLIGADAQS", "CODPROVAQS", "NOMEQUESTIONARIO"],
        },
        {
          title: "Fórmula para classificação geral",
          table: "SPSProcessoSeletivo",
          fields: ["CODFORMULAGERAL", "CODFORMULAGERALEB", "CODFORMULAGERALES"],
        },
        {
          title: "Agrupador de áreas de interesse",
          table: "SPSProcessoSeletivo",
          fields: ["GRUPOAREAINTERESSE", "TEXTOGRUPOAREAINTERESSE"],
        },
        {
          title: "Envio de arquivos",
          table: "SPSProcessoSeletivo",
          fields: ["ENVIOARQUIVOS", "LIMITEARQUIVOS", "TAMANHOARQUIVO"],
        },
        {
          title: "Boleto e comprovante",
          table: "SPSProcessoSeletivo",
          fields: [
            "CODCOLIGADARELBOLETO",
            "IDRELBOLETO",
            "CODCOLIGADARELCOMPRVT",
            "IDRELCOMPRVT",
            "CODCOLIGADARPTBOLETO",
            "IDRPTBOLETO",
            "CODCOLIGADARPTCOMPRVT",
            "IDRPTCOMPRVT",
            "TIPOBOLETO",
            "CABECALHOCOMPROVANTE",
            "BOLETOCOMPROVANTE",
          ],
        },
        {
          title: "Prova Fácil",
          table: "SPSProcessoSeletivo",
          fields: ["USAPROVAFACIL", "PROVAFACILDISTRIB"],
        },
      ],
    },
    {
      name: "Calendário",
      sections: [
        {
          title: "Inscrições",
          table: "SPSProcessoSeletivo",
          fields: ["DTINIINSCRICAO", "DTFIMINSCRICAO"],
        },
        {
          title: "Seleção",
          table: "SPSProcessoSeletivo",
          fields: ["DTINISELECAO", "DTFIMSELECAO"],
        },
        {
          title: "Divulgação de resultados",
          table: "SPSProcessoSeletivo",
          fields: ["DTINIRESULTADO", "DTFIMRESULTADO"],
        },
        {
          title: "Fase",
          table: "SPSProcessoSeletivo",
          fields: ["FASE", "DESCRICAOFASE"],
        },
      ],
    },
    {
      name: "Portaria",
      sections: [
        {
          table: "SPSProcessoSeletivo",
          fields: ["PORTARIA"],
        },
      ],
    },
    {
      name: "Informações financeiras",
      sections: [
        {
          title: "Inscrições — Geral 1",
          table: "SPSProcessoSeletivo",
          fields: [
            "CODCFO",
            "CODCOLCFO",
            "CODTDO",
            "HISTORICO",
            "CODMOEVALORORIGINAL",
            "PAGAMENTOCARTAO",
            "PAGAMENTOPIX",
            "LANCBOLETOCOMREGISTRO",
            "SHOWBOLETONAOREGPORTAL",
            "CODCXA",
            "CODCOLCXA",
            "IDCONVENIO",
          ],
        },
        {
          title: "Inscrições — Geral 2",
          table: "SPSProcessoSeletivo",
          fields: [
            "CODFILIALLAN",
            "CODDEPARTAMENTO",
            "CODCCUSTO",
            "CODCOLNATFINANCEIRA",
            "CODNATFINANCEIRA",
            "TIPOCONTABILLAN",
            "CODEVENTOINCLUSAO",
            "CODEVENTOBAIXA",
            "DATAEMISSAO",
          ],
        },
        {
          title: "Inscrições — Opcionais",
          table: "SPSProcessoSeletivo",
          fields: [
            "CODTB1FLX",
            "CODTB2FLX",
            "CODTB3FLX",
            "CODTB4FLX",
            "CODTB5FLX",
            "CAMPOALFAOP1",
            "CAMPOALFAOP2",
            "CAMPOALFAOP3",
          ],
        },
        {
          title: "Baixa automática",
          table: "SPSProcessoSeletivo",
          fields: [
            "BAIXAAUTOMATICALANINSCRICAO",
            "IDFORMAPGTOBXAUTOMATICA",
            "USADATABAIXAIGUALVENCIMENTO",
            "USADATACONTABILIZACAOBAIXA",
            "EMAILALERTABXAUTOMATICA",
            "NAOEXIBEBOLETOVENCIDO",
          ],
        },
        {
          title: "Débito financeiro",
          table: "SPSProcessoSeletivo",
          fields: ["ALERTADEBITOFIN", "BLOQINSCRICAODEBITOFIN", "MSGDEBITOFINANCEIRO"],
        },
        {
          title: "Pgto. de profissionais",
          table: "SPSProcessoSeletivo",
          fields: [
            "PAGPROF_CODCXA",
            "PAGPROF_CODCOLCXA",
            "PAGPROF_CODTDOPESSOAFISICA",
            "PAGPROF_CODTDOPESSOAJURIDICA",
            "PAGPROF_CODMOEVALORORIGINAL",
            "PAGPROF_HISTORICO",
            "PAGPROF_CODCUSTO",
            "PAGPROF_CODEVENTOBAIXA",
            "PAGPROF_CODEVENTOINCLUSAO",
            "PAGPROF_CODFILIALLAN",
            "PAGPROF_CODDEPARTAMENTO",
            "PAGPROF_DATALANCAMENTO",
            "PAGPROF_CODEVENTO",
            "PAGPROF_CODTIPOFIXO",
            "PAGPROF_CODRECEITAPF",
            "PAGPROF_CODRECEITAPJ",
            "PAGPROF_TIPOCONTABILLAN",
            "PAGPROF_CODCOLNATFINANCEIRA",
            "PAGPROF_CODNATFINANCEIRA",
            "PAGPROF_CODTB1FLX",
            "PAGPROF_CODTB2FLX",
            "PAGPROF_CODTB3FLX",
            "PAGPROF_CODTB4FLX",
            "PAGPROF_CODTB5FLX",
            "PAGPROF_CAMPOALFAOP1",
            "PAGPROF_CAMPOALFAOP2",
            "PAGPROF_CAMPOALFAOP3",
          ],
        },
      ],
    },
    {
      name: "E-mails",
      sections: [
        {
          table: "SPSProcessoSeletivo",
          fields: ["ENVIAEMAIL", "UTILIZAEMAILPERSONALIZADO", "TEXTOEMAIL", "EMAILALERTAS"],
        },
      ],
    },
    {
      name: "Parâmetros",
      sections: [
        {
          title: "Informações",
          table: "SPSProcessoSeletivo",
          fields: [
            "USANOVOPORTAL",
            "NOMEPORTALINSCRICOES",
            "USASENHALOGIN",
            "LOGINCPF",
            "LOGINRG",
            "LOGINCODUSUARIO",
            "LOGINEMAIL",
            "GRUPOPESQUISA1",
            "GRUPOPESQUISA2",
            "GRUPOPESQUISA3",
            "REGRACRITERIOBUSCA",
            "APROVEITADADOSPESSOA",
            "TIPOALTERACAODADOS",
          ],
        },
        {
          title: "Inscrições",
          table: "SPSProcessoSeletivo",
          fields: [
            "GRAVARDADOSMAIUSCULO",
            "EXIGESOBRENOME",
            "OBRIGATORIOCPFPASRG",
            "PAISORIGEMPS",
            "NAOOBRIGADOCSCANDEST",
            "NAOOBRIGADOCSRESPEST",
            "RESPONSAVELCANDIDATO",
            "OBRIGATORIORESPINSC",
            "TEXTOTREINEIRO",
            "USACAMPUSPOLOMATRICULANAINSC",
            "PERMITEINSCFAMILIA",
            "UTILIZATERMOIMGVOZ",
            "UTILIZAFICHAMEDICA",
            "BLOQRESPMENORINSC",
            "TEMPOINSCRESERVAVAGACANDIDATO",
          ],
        },
        {
          title: "Responsáveis",
          table: "SPSProcessoSeletivo",
          fields: [
            "USADADOSPAI",
            "USADADOSMAE",
            "USADADOSRESPFIN",
            "USADADOSRESPACAD",
            "USADADOSRESPLEGAL",
            "NAOEXIGEDADOSPAI",
            "NAOEXIGEDADOSMAE",
            "NAOEXIGEDADOSRESPACAD",
            "NAOEXIGEDADOSRESPFIN",
            "TIPOFILIACAOOBRIG",
          ],
        },
        {
          title: "Endereço padrão",
          table: "SPSProcessoSeletivo",
          fields: [
            "IDPAISDEFAULT",
            "ESTADODEFAULT",
            "CIDADEDEFAULT",
            "CODMUNICIPIODEFAULT",
            "CODTIPORUADEFAULT",
            "CODTIPOBAIRRODEFAULT",
          ],
        },
        { title: "Visibilidade/obrigatoriedade de campos", table: "SPSParamsCampos" },
        {
          title: "Resultados",
          table: "SPSProcessoSeletivo",
          fields: [
            "PSABERTOSDISPONIVEISCONSULTA",
            "PSANDAMENTODISPONIVEISCONSULTA",
            "PSRESULTADODISPONIVEISCONSULTA",
            "MOSTRANUMVAGAS",
            "MOSTRACLASSIFICACAO",
            "MOSTRAPONTUACAO",
            "MOSTRARNUMINSC",
            "MOSTRARSITUACAO",
            "MOSTRARCAMPOCLASSGERAL",
            "MOSTRARPONTUACAOGERAL",
            "MOSTRARESULTGERAL",
            "MOSTRACANDDESC",
            "MOSTRARCLASSGERAL",
            "MOSTRARCHAMADAS",
            "MOSTRABOLSAALCANCADA",
          ],
        },
        {
          title: "Redes sociais",
          table: "SPSProcessoSeletivo",
          fields: ["URLFACEBOOK", "URLTWITTER", "URLINSTAGRAM", "NUMEROWHATSAPP"],
        },
        {
          title: "Arquivos",
          table: "SPSProcessoSeletivo",
          fields: ["TIPOARQUIVO", "DIRETORIOARQUIVO", "TAMANHOMAXIMOARQUIVO", "EXTENSAOARQUIVO"],
        },
        {
          title: "Campo complementar",
          table: "SPSProcessoSeletivo",
          fields: ["USACAMPOCOMPLEMENTAR"],
        },
        { title: "Campos complementares por filial", table: "SPSCAMPOCOMPLFILIALGRUPO" },
        {
          title: "Central do candidato e textos do portal",
          table: "SPSProcessoSeletivo",
          fields: [
            "TEXTOAREAPUBLICA",
            "USAHTMLTEXTOAREAPUBLICA",
            "TEXTOAREAINSCRICOES",
            "USAHTMLTEXTOAREAINSCRICOES",
            "TEXTOAREARESULTADOS",
            "USAHTMLTEXTOAREARESULTADOS",
            "TEXTOCOMPROVANTE",
            "USAHTMLTEXTOCOMPROVANTE",
            "TEXTOLOGIN",
            "TEXTORECUPERARSENHA",
            "SERVICOINSCRICAO",
            "SERVICORESULTADO",
          ],
        },
        {
          title: "Integrações (Rubeus)",
          table: "SPSProcessoSeletivo",
          fields: [
            "USAINTEGRACAORUBEUS",
            "URLAPIRUBEUS",
            "TOKENRUBEUS",
            "CODORIGEMRUBEUS",
            "CODTIPOEVENTO1RUBEUS",
            "CODTIPOEVENTO2RUBEUS",
            "CODTIPOEVENTO3RUBEUS",
            "CODTIPOEVENTO4RUBEUS",
            "CODTIPOEVENTO5RUBEUS",
          ],
        },
        {
          title: "Matrícula",
          table: "SPSProcessoSeletivo",
          fields: ["TEXTOINSTRUCOESMATRICULA", "USAHTMLTXTINSTRUCOESMATRICULA", "TEXTOCONFIRMACAOMATRICCENTRAL"],
        },
      ],
    },
    {
      name: "Venda online de cursos",
      sections: [
        {
          table: "SPSProcessoSeletivo",
          fields: [
            "VALIDARDOCUMENTOSMAT",
            "COPIARARQUIVOSMAT",
            "UTILIZAMARKETPLACE",
            "UTILIZAVTEX",
            "OFERTAEXCLUSIVAB2B",
          ],
        },
      ],
    },
    {
      name: "Cotas",
      sections: [
        {
          title: "No processo seletivo",
          table: "SPSProcessoSeletivo",
          fields: ["COTAFEDERAL", "PERGUNTAACEITE", "PERGUNTACORRACA", "PERGUNTAENSINOPUBLICO", "PERGUNTARRENDA"],
        },
        { title: "Cotas da instituição federal", table: "SPSCotaInstituicaoFederal" },
      ],
    },
    {
      name: "Forma de inscrição",
      sections: [{ table: "SPSFormaInscricaoPS" }],
    },
    {
      name: "Campos complementares",
      sections: [{ table: "SPSProcSelCompl" }],
    },
  ],
  EduPSAreaOfertadaData: [
    {
      name: "Identificação",
      sections: [
        {
          title: "Identificação",
          table: "SPSAreaOfertada",
          fields: [
            "STATUS",
            "IDPS",
            "IDAREAINTERESSE",
            "NOME",
            "NUMEROVAGAS",
            "VALORINSCRICAO",
            "NUMMININSCRICOES",
            "NUMMAXAREASOPCIONAIS",
          ],
        },
        { title: "Inscrições", table: "SPSAreaOfertada", fields: ["DTINICIOINSCRICAO", "DTTERMINOINSCRICAO"] },
      ],
    },
    {
      name: "Informações complementares",
      sections: [
        {
          title: "Idiomas oferecidos",
          table: "SPSAreaOfertada",
          fields: ["NUMMAXIDIOMASINSCRICAO", "NUMMINIDIOMASINSCRICAO"],
        },
        {
          title: "Faixa etária",
          table: "SPSAreaOfertada",
          fields: ["CONTROLEFAIXAETARIA", "DTNASCIMENTOMINIMA", "DTNASCIMENTOMAXIMA"],
        },
        {
          title: "Opções",
          table: "SPSAreaOfertada",
          fields: [
            "INCIDEDESCONTO",
            "UTILIZAENEM",
            "USANOVOPORTAL",
            "USALOCALPROVAONLINE",
            "USACAMPUSPOLOMATRICULANAINSC",
            "PERCDESCONTOMINIMO",
            "GRUPO",
            "PORTARIA",
          ],
        },
        {
          title: "Fórmula para cálculo de pontuação",
          table: "SPSAreaOfertada",
          fields: ["CODFORMULARESULTADO", "CODFORMULARESULTADOEB", "CODFORMULARESULTADOES"],
        },
        {
          title: "Questionário e itinerários",
          table: "SPSAreaOfertada",
          fields: ["CODCOLIGADAQS", "CODPROVAQS", "MINIMOITINERARIOS", "MAXIMOITINERARIOS"],
        },
      ],
    },
    {
      name: "Inf. financeiras",
      sections: [{ table: "SPSAreaOfertada", fields: ["CODCOLCXA", "CODCXA"] }],
    },
    {
      name: "Termo de aceite",
      sections: [{ table: "SPSAreaOfertada", fields: ["TERMOACEITE", "DESCARTARCONTRATO"] }],
    },
    {
      name: "Distribuir prova",
      sections: [
        { table: "SPSAreaOfertada", fields: ["ALOCADISTRIBUIPROVA", "ASSUNEMAILDISTPROVA", "TEXTOEMAILDISTPROVA"] },
      ],
    },
    {
      name: "Matrícula",
      sections: [
        { table: "SPSAreaOfertada", fields: ["DISPONIBILIZAMATRICULAPORTAL"] },
        {
          title: "Acadêmico",
          table: "SPSParametrosAreaOfertada",
          fields: [
            "CODFILIAL",
            "IDPERLET",
            "IDHABILITACAOFILIAL",
            "CODTURMA",
            "CODSTATUSMATRICCURSO",
            "CODSTATUSMATRICPERIODOLETIVO",
            "CODTIPOMAT",
            "CODSTATUSMATRICDISCIPLINAS",
            "CODCAMPUS",
            "DATAINGRESSO",
            "PERMITEENVIODOCUMENTOS",
            "INCLUIRLISTAESPERA",
            "TIPOESCOLHAGERARRA",
            "SOBRESCREVERDEFICIENCIASALUNOS",
            "SOBRESCREVERENDERECOALUNOS",
            "SOBRESCREVERDADOSPESSOAISALUNO",
            "SOBRESCREVERDADOSRESPFINALUNO",
            "EXIBIRITINERARIO",
          ],
        },
        {
          title: "Financeiro",
          table: "SPSParametrosAreaOfertada",
          fields: [
            "CADASTRACONTRATO",
            "GERARLANCAMENTO",
            "CODPLANOPGTO",
            "ALTERAPLNOPGTOPORTAL",
            "CADASTRAALUNOCOMORESPFINANC",
            "CADASTRARESPONSAVELPSCOMORESPF",
            "SUBSTITUIRESPFINANC",
            "SOMENTERESPFINACEITACONTRATO",
            "PARCELAINICIAL",
            "PARCELAFINAL",
            "COTAINICIAL",
            "COTAFINAL",
            "DTCOMPETENCIAINICIAL",
            "DTCOMPETENCIAFINAL",
            "PERMITERECORRENCIA",
            "CODCOLRPTCONTRATO",
            "IDRPTCONTRATO",
            "UTILIZATOKENASSINATURACONTRATO",
            "UTILIZATAEASSINATURACONTRATO",
            "NAOUSAFLEXALTDTVENC",
            "NAOUSAFLEXREMOVEPARC",
          ],
        },
        {
          title: "Perfil do usuário",
          table: "SPSParametrosAreaOfertada",
          fields: [
            "MATRICULAALUNOCOMATRASOBIBLIOT",
            "MATRICULAALUNOCOMDEBITOBIBLIOT",
            "MATRICULAALUNOINADIMPLENTE",
            "MATRICULAALUNOSCOMOCORRENCIA",
            "MATRICULAALUNOSEMDOCOBRIGATORI",
            "MATRICULACOMCONFLITOHORARIOS",
            "MATRICULACOMCONFLITOPREREQ",
            "MATRICULAEMTURMACHEIA",
            "MATRICULAFORADOPERIODO",
            "MATRICULASEMMINCREDPLETIVO",
          ],
        },
        {
          title: "Alteração de dados",
          table: "SPSParametrosAreaOfertada",
          fields: [
            "MATATUALDADOSPAI",
            "MATATUALDADOSMAE",
            "MATATUALDADOSRESPFIN",
            "MATATUALDADOSRESPACA",
            "MATOBRIGDADOSPAI",
            "MATOBRIGDADOSMAE",
            "MATOBRIGDADOSRESPFIN",
            "MATOBRIGDADOSRESPACA",
            "TIPOFILIACAOOBRIG",
            "USADADOSRESPLEGAL",
            "PERMITERESPMENOR",
          ],
        },
      ],
    },
    { name: "Documento exigido", sections: [{ table: "SPSDocumentoExigido" }] },
    { name: "Idioma ofertado", sections: [{ table: "SPSIdiomaAreaOfertada" }] },
    {
      name: "Etapas",
      sections: [
        { title: "Etapas", table: "SPSEtapaAreaOfertada" },
        { title: "Horários", table: "SPSHorarioEtapaAreaOfertada" },
        { title: "Provas da etapa", table: "SPSProvaEtapaArea" },
      ],
    },
    { name: "Itinerário formativo", sections: [{ table: "SPSItinerarioOfertado" }] },
  ],
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Resolves a layout against the Data Server's real schema: table names are matched
 * case-insensitively (and sections whose table doesn't exist are dropped), main-table fields no
 * section lists go to an "Outros campos" tab, and schema tables the layout never mentions get a
 * tab of their own — so nothing TOTVS returns is ever hidden by an outdated mapping.
 */
export function buildLayoutTabs(layout: LayoutTab[], tables: ChecklistTableMeta[], mainTable: string): LayoutTab[] {
  const resolveTable = (name: string) => tables.find((t) => sameName(t.name, name))?.name

  const tabs: LayoutTab[] = layout
    .map((tab) => ({
      name: tab.name,
      sections: tab.sections.flatMap((section) => {
        const table = resolveTable(section.table)
        return table ? [{ ...section, table }] : []
      }),
    }))
    .filter((tab) => tab.sections.length > 0)

  const sections = tabs.flatMap((tab) => tab.sections)
  const otherSections: LayoutSection[] = []
  const unmappedTabs: LayoutTab[] = []

  for (const table of tables) {
    const tableSections = sections.filter((s) => sameName(s.table, table.name))
    const isMain = sameName(table.name, mainTable)
    if (!tableSections.length && !isMain) {
      unmappedTabs.push({ name: table.name, sections: [{ table: table.name }] })
      continue
    }
    if (tableSections.some((s) => !s.fields)) continue // whole table already shown
    const listed = new Set(tableSections.flatMap((s) => s.fields ?? []).map((f) => f.toLowerCase()))
    // Child-table keys (coligada/IDPS/área) only repeat the parent's — not worth a card.
    const leftovers = table.fields.filter((f) => !listed.has(f.name.toLowerCase()) && (isMain || !f.isPrimaryKey))
    if (leftovers.length) {
      otherSections.push({
        title: isMain ? undefined : table.name,
        table: table.name,
        fields: leftovers.map((f) => f.name),
      })
    }
  }

  if (otherSections.length) tabs.push({ name: OTHERS_TAB_NAME, sections: otherSections })
  return [...tabs, ...unmappedTabs]
}
