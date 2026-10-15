import type { PermissionModel } from "@/config/tbc-permission-models/types"
import { CAPTACAO_PROCESSO_SELETIVO } from "@/config/tbc-permission-models/captacao/processo-seletivo"
import { CAPTACAO_EDUCACIONAL } from "@/config/tbc-permission-models/captacao/educacional"
import { CAPTACAO_FINANCEIRO } from "@/config/tbc-permission-models/captacao/financeiro"
import { CAPTACAO_AVALIACAO } from "@/config/tbc-permission-models/captacao/avaliacao"

export const CAPTACAO_MODEL: PermissionModel = {
  key: "captacao",
  label: "Captação",
  profiles: [CAPTACAO_PROCESSO_SELETIVO, CAPTACAO_EDUCACIONAL, CAPTACAO_FINANCEIRO, CAPTACAO_AVALIACAO],
  dataservers: [
    { group: "Processo Seletivo", code: "EduPSProcessoSeletivoData", label: "Processo Seletivo" },
    { group: "Processo Seletivo", code: "EduPSAreaOfertadaData", label: "Área de Interesse Ofertada" },
    { group: "Processo Seletivo", code: "EduPSCampusData", label: "Campus" },
    { group: "Processo Seletivo", code: "EduPSPredioData", label: "Prédio" },
    { group: "Processo Seletivo", code: "EduPSAreaInteresseData", label: "Área de Interesse" },
    { group: "Processo Seletivo", code: "EduPSCategoriaProcSelData", label: "Categoria do Processo Seletivo" },
    { group: "Processo Seletivo", code: "EduPSFormaInscricaoPSData", label: "Forma de Inscrição" },
    { group: "Processo Seletivo", code: "EduPSAtividadeAgendadaData", label: "Atividade Agendada" },
    { group: "Processo Seletivo", code: "EduPSConcursoBolsaData", label: "Concurso de Bolsas" },
    { group: "Processo Seletivo", code: "EduPSUsuarioData", label: "Usuário (Candidato)" },
    { group: "Processo Seletivo", code: "EduPSInscricaoAreaOfertadaData", label: "Inscrição do Candidato" },
    { group: "Processo Seletivo", code: "EduPSDocumentoEntregueData", label: "Documentação do Candidato" },
    { group: "Processo Seletivo", code: "EduPSLocalEtapaInscritoData", label: "Local da Prova do Candidato" },
    { group: "Educacional", code: "EduAlunoData", label: "Aluno" },
    { group: "Educacional", code: "EduHabilitacaoAlunoData", label: "Curso / Habilitação do Aluno" },
    { group: "Educacional", code: "EduContratoData", label: "Contrato" },
    { group: "Educacional", code: "EduMatricPLData", label: "Matrícula no Período Letivo" },
    { group: "Educacional", code: "EduPLetivoData", label: "Período Letivo" },
    { group: "Educacional", code: "EduCursoData", label: "Curso" },
    { group: "Educacional", code: "EduGradeData", label: "Matriz Curricular" },
    { group: "Educacional", code: "EduParcPlanoData", label: "Parcelas do Plano de Pagamento" },
    { group: "Educacional", code: "EduBolsaAlunoData", label: "Bolsa do Aluno" },
    { group: "Educacional", code: "EduResponsavelAlunoData", label: "Responsável do Aluno" },
    { group: "Financeiro", code: "FinCFODataBR", label: "Cliente/Fornecedor" },
    { group: "Financeiro", code: "FinLanDataBR", label: "Lançamento Financeiro" },
    { group: "Global", code: "RhuPessoaData", label: "Pessoa" },
    { group: "Global", code: "GlbConsSQLData", label: "Consultas SQL" },
    { group: "Global", code: "RptReportsData", label: "RM Reports" },
  ],
}
