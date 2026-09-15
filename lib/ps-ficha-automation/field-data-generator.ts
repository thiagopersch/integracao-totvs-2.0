import type { ItemSpec } from "@/lib/ps-docs/types";

/**
 * Decide como preencher UM campo da ficha real no navegador, a partir do `ItemSpec` já resolvido
 * pela Documentação PS (`lib/ps-docs/`). Nunca inventa dado quando a própria ficha já tem um valor
 * configurado (`valorPadrao`/`opcoesManuais`) — só gera dado fictício quando não há outra fonte.
 *
 * Deliberadamente não tenta gerar string a partir de regex (`validacoes` tipo "pattern") — na
 * amostra real inspecionada (CPF, e-mail, telefone, data) todos os campos eram identificáveis por
 * `mascara`/`tipo`, então a heurística de máscara+tipo cobre o caso comum sem precisar de um motor
 * de regex→string. Um campo com validação de padrão que a heurística abaixo não cobrir só é
 * reportado como falha pelo motor de automação (`browser-engine.ts`), que lê o erro que o Form.io
 * realmente mostrou — não trava a geração do dado em si.
 */

export type FichaFieldFillStrategy =
  | { kind: "text"; value: string }
  | { kind: "select"; value?: string; useLiveOptions: boolean }
  | { kind: "checkbox"; checked: boolean }
  | { kind: "skip"; reason: string };

function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function randomAlnum(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Gera um CPF com dígito verificador válido (algoritmo mod-11 padrão), como uma string de 11 dígitos. */
function generateValidCpfDigits(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  const calcDigit = (nums: number[]) => {
    let sum = 0;
    let weight = nums.length + 1;
    for (const d of nums) {
      sum += d * weight;
      weight--;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calcDigit(base);
  const d2 = calcDigit([...base, d1]);
  return [...base, d1, d2].join("");
}

/** Aplica uma máscara no estilo Form.io (`9`=dígito, `a`=letra, `*`=alfanumérico, resto é literal)
 *  consumindo caracteres de `source` para cada placeholder. */
function applyMask(mask: string, source: string): string {
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (ch === "9" || ch === "a" || ch === "*") {
      out += source[i] ?? "0";
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

function labelText(item: ItemSpec): string {
  return `${item.detalhes?.basico.rotulo ?? ""} ${item.nome ?? ""} ${item.detalhes?.basico.placeholder ?? ""}`.toLowerCase();
}

function generateCpf(mascara?: string): string {
  const digits = generateValidCpfDigits();
  return mascara ? applyMask(mascara, digits) : applyMask("999.999.999-99", digits);
}

function generatePhone(mascara?: string): string {
  const ddd = String(11 + Math.floor(Math.random() * 78)); // 11-88, DDDs válidos no Brasil
  const digits = `${ddd}9${randomDigits(8)}`;
  return mascara ? applyMask(mascara, digits) : applyMask("(99) 99999-9999", digits);
}

/** CEPs reais (uma capital por região), por explícita instrução — um CEP inexistente pode falhar
 *  a consulta assíncrona de endereço que o campo dispara (a mesma que `fillPasso` já espera). */
const REAL_CEPS = [
  "01310-100", // Av. Paulista, São Paulo/SP
  "20040-020", // Centro, Rio de Janeiro/RJ
  "30130-010", // Centro, Belo Horizonte/MG
  "40010-000", // Centro, Salvador/BA
  "60060-090", // Centro, Fortaleza/CE
  "70040-010", // Asa Sul, Brasília/DF
  "80010-000", // Centro, Curitiba/PR
  "90010-150", // Centro, Porto Alegre/RS
];

function generateCep(mascara?: string): string {
  const cep = REAL_CEPS[Math.floor(Math.random() * REAL_CEPS.length)];
  if (!mascara || mascara === "99999-999") return cep;
  return applyMask(mascara, cep.replace(/\D/g, ""));
}

/** Sufixo pedido por explícita instrução: identifica visualmente todo dado gerado pela automação
 *  como um teste (nome, e-mail) — facilita reconhecer/limpar registros de teste no TOTVS depois. */
const TESTE_RUBEUS_SUFFIX = "Teste Rubeus";

const FIRST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Patrícia", "Rafael", "Sabrina", "Tiago", "Vanessa", "Wesley"];
const LAST_NAMES = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha"];

function generateFullName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last} ${TESTE_RUBEUS_SUFFIX}`;
}

function generateEmail(): string {
  return `${randomAlnum(6)}testerubeus@example.com`;
}

/** Data no formato exibido pelo flatpickr confirmado ao vivo (`DD/MM/AAAA`). Campos de nascimento
 *  (detectados pelo rótulo) recebem uma idade plausível (18-40 anos); os demais, uma data recente. */
function generateDate(item: ItemSpec): string {
  const isBirthdate = labelText(item).includes("nascim");
  const now = new Date();
  const yearsAgo = isBirthdate ? 18 + Math.floor(Math.random() * 22) : Math.floor(Math.random() * 2);
  const daysAgo = isBirthdate ? 0 : Math.floor(Math.random() * 300);
  const date = new Date(now.getFullYear() - yearsAgo, now.getMonth(), now.getDate());
  date.setDate(date.getDate() - daysAgo);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Os 5 formatos que a "inteligência" de validação de regras (`browser-engine.ts`,
 *  `probeFieldRules`) sabe testar com valores propositalmente inválidos, além de gerar o valor
 *  final válido — mesma detecção usada nos dois lugares, pra nunca divergir. */
type RecognizableKind = "cpf" | "email" | "phone" | "date" | "cep";

function detectRecognizableKind(item: ItemSpec): RecognizableKind | null {
  if (item.categoria === "cep") return "cep";
  const tipo = item.tipo;
  const mascara = item.detalhes?.basico.mascara;
  const label = labelText(item);

  if (label.includes("cpf") || (mascara && /9{3}\.9{3}\.9{3}-9{2}/.test(mascara))) return "cpf";
  if (tipo === "email" || label.includes("e-mail") || label.includes("email")) return "email";
  if (tipo === "phoneNumber" || label.includes("celular") || label.includes("telefone")) return "phone";
  if (tipo === "datetime" || label.includes("data")) return "date";
  return null;
}

export function planFieldFill(item: ItemSpec): FichaFieldFillStrategy {
  if (item.categoria !== "campo" && item.categoria !== "cep") return { kind: "skip", reason: "não é um campo preenchível" };
  if (!item.fieldId) return { kind: "skip", reason: "sem field_id resolvido" };

  const detalhes = item.detalhes;
  if (detalhes?.basico.desabilitar) return { kind: "skip", reason: "campo desabilitado" };
  if (detalhes?.basico.esconder) return { kind: "skip", reason: "campo oculto" };
  if (detalhes?.dados.somenteLeitura) return { kind: "skip", reason: "campo somente leitura" };

  // Valor já configurado na própria ficha — sempre prioridade sobre qualquer geração.
  if (detalhes?.dados.tipoValorPadrao === "simples" && detalhes.dados.valorPadrao) {
    return { kind: "text", value: detalhes.dados.valorPadrao };
  }

  const opcoes = detalhes?.dados.opcoesPredefinidas;
  if (opcoes?.ativado) {
    if (opcoes.fonte === "Manual" && opcoes.opcoesManuais && opcoes.opcoesManuais.length > 0) {
      return { kind: "select", value: opcoes.opcoesManuais[0].value, useLiveOptions: false };
    }
    // Fonte TOTVS/externa: as opções só existem depois de renderizadas de verdade — o motor de
    // automação lê o <select>/grupo de radio ao vivo e escolhe a primeira opção válida.
    return { kind: "select", useLiveOptions: true };
  }

  const tipo = item.tipo;
  const mascara = detalhes?.basico.mascara;
  const label = labelText(item);

  if (tipo === "checkbox") {
    return { kind: "checkbox", checked: !!item.obrigatorio };
  }

  const recognized = detectRecognizableKind(item);
  if (recognized === "cep") return { kind: "text", value: generateCep(mascara) };
  if (recognized === "cpf") return { kind: "text", value: generateCpf(mascara) };
  if (recognized === "email") return { kind: "text", value: generateEmail() };
  if (recognized === "phone") return { kind: "text", value: generatePhone(mascara) };
  if (recognized === "date") return { kind: "text", value: generateDate(item) };
  if (tipo === "number") return { kind: "text", value: String(1 + Math.floor(Math.random() * 100)) };
  // Qualquer campo de nome (completo, social, responsável, mãe/pai etc.) — sempre sufixado
  // "Teste Rubeus", por explícita instrução, pra ficar reconhecível como dado de teste.
  if (label.includes("nome")) return { kind: "text", value: generateFullName() };
  if (mascara) return { kind: "text", value: applyMask(mascara, randomAlnum(mascara.length)) };
  if (tipo === "select" || tipo === "radio" || tipo === "selectboxes") return { kind: "select", useLiveOptions: true };

  return { kind: "text", value: `Teste automação (${item.detalhes?.basico.rotulo ?? item.nome})`.slice(0, 60) };
}

/** Duas variações propositalmente inválidas por campo de formato reconhecível — usadas pela
 *  "inteligência" de validação de regras (`probeFieldRules`) pra confirmar que a ficha realmente
 *  bloqueia valor mal formatado antes de aceitar o valor final válido. `null` quando o campo não é
 *  de um formato reconhecível (nesse caso não há o que sondar, só o valor gerado normal mesmo). */
export function invalidVariantsFor(item: ItemSpec): string[] | null {
  const recognized = detectRecognizableKind(item);
  if (!recognized) return null;
  const mascara = item.detalhes?.basico.mascara;

  switch (recognized) {
    case "cpf":
      // Muito curto (nunca completa a máscara); e um CPF de dígitos repetidos — formato certo,
      // mas explicitamente inválido (todo validador de CPF real rejeita sequências repetidas).
      return ["123", applyMask(mascara ?? "999.999.999-99", "11111111111")];
    case "email":
      return ["semarroba.com", "faltandodominio@"];
    case "phone":
      return ["123", "abcdefghij"];
    case "date":
      return ["31/02/2030", "99/99/9999"];
    case "cep":
      return ["123", "00000-000"];
  }
}
