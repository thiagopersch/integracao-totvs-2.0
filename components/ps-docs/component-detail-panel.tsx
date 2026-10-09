"use client"

import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ComponentAction, ComponentDetail } from "@/lib/ps-docs/component-detail"
import type { LogicaSpec, ParametroAcaoSpec } from "@/lib/ps-docs/types"
import { cn } from "@/lib/utils"

const dash = (value?: string) => value || "—"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function ParametrosTable({ parametros }: { parametros: ParametroAcaoSpec[] }) {
  if (parametros.length === 0) return <p className="text-xs text-muted-foreground">Nenhum parâmetro.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parâmetro</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {parametros.map((p, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{p.nome}</TableCell>
            <TableCell className="text-xs">{p.tipo}</TableCell>
            <TableCell className="text-xs">{p.tipo === "Valor fixo" ? <code>{dash(p.valorFixo)}</code> : dash(p.campoSistema)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CamposTable({ acao }: { acao: ComponentAction }) {
  if (acao.campos.length === 0) return <p className="text-xs text-muted-foreground">Nenhum field configurado.</p>
  const hasTabela = acao.campos.some((c) => c.tabela)
  const hasColuna = acao.campos.some((c) => c.coluna)
  const hasDescricao = acao.campos.some((c) => c.descricao)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          {hasTabela && <TableHead>Tabela</TableHead>}
          {hasColuna && <TableHead>Coluna</TableHead>}
          <TableHead>Valor</TableHead>
          {hasDescricao && <TableHead>Descrição</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {acao.campos.map((c, i) => (
          <TableRow key={i}>
            <TableCell className="text-xs">{dash(c.titulo)}</TableCell>
            {hasTabela && <TableCell className="font-mono text-xs">{dash(c.tabela)}</TableCell>}
            {hasColuna && <TableCell className="font-mono text-xs">{dash(c.coluna)}</TableCell>}
            <TableCell className="text-xs">
              {c.valorFixo !== undefined ? (
                <span>
                  Valor fixo: <code>{c.valorFixo}</code>
                </span>
              ) : (
                dash(c.campo)
              )}
            </TableCell>
            {hasDescricao && <TableCell className="text-xs whitespace-normal">{dash(c.descricao)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function LogicaText({ logica }: { logica?: LogicaSpec }) {
  if (!logica) return null
  return (
    <Section title="Lógica">
      <p className="text-xs">
        {logica.acao ?? "Regra"}
        {logica.condicao ? ` — ${logica.condicao}` : ""}:
      </p>
      <ul className="list-disc pl-5 text-xs">
        {logica.regras.map((r, i) => (
          <li key={i}>{[r.campo, r.regra, r.valor].filter(Boolean).join(" ")}</li>
        ))}
      </ul>
    </Section>
  )
}

function ActionBlock({ acao }: { acao: ComponentAction }) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{acao.titulo}</Badge>
        {acao.descricao && <span className="text-sm">{acao.descricao}</span>}
        {acao.repetir && <Badge variant="outline">Repetir</Badge>}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {acao.consulta && (
          <>
            <div>
              <dt className="inline text-muted-foreground">Consulta: </dt>
              <dd className="inline font-mono">{acao.consulta.codigo}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Coligada / Sistema: </dt>
              <dd className="inline font-mono">
                {dash(acao.consulta.coligada)} / {dash(acao.consulta.sistema)}
              </dd>
            </div>
            {acao.consulta.usaCache && (
              <div>
                <dt className="inline text-muted-foreground">Cache: </dt>
                <dd className="inline">{acao.consulta.frequenciaCache ?? "sim"}</dd>
              </div>
            )}
          </>
        )}
        {acao.destino && (
          <div>
            <dt className="inline text-muted-foreground">{acao.tipoAcao === "Executar processo" ? "Processo" : "Dataserver"}: </dt>
            <dd className="inline">{acao.destino}</dd>
          </div>
        )}
      </dl>
      <Section title={`Parâmetros (${acao.parametros.length})`}>
        <ParametrosTable parametros={acao.parametros} />
      </Section>
      <Section title={`Fields (${acao.campos.length})`}>
        <CamposTable acao={acao} />
      </Section>
      {acao.contexto.length > 0 && (
        <Section title="Contexto">
          <ul className="list-disc pl-5 text-xs">
            {acao.contexto.map((c, i) => (
              <li key={i}>
                {c.nome} ← {dash(c.campoVinculado)}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {acao.eventos && (
        <Section title="Eventos Rubeus">
          <ul className="list-disc pl-5 text-xs">
            {acao.eventos.map((e, i) => (
              <li key={i}>
                {e.codigo}
                {e.descricao ? ` — ${e.descricao}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <LogicaText logica={acao.logica} />
    </div>
  )
}

/** Full config of one component (`GET /api/custom-component/{id}`), shown in an expanded row of
 *  "Busca de campos PS". `highlightOrdem` opens and marks the button_action the search matched. */
export function ComponentDetailPanel({ detail, highlightOrdem }: { detail: ComponentDetail; highlightOrdem?: number }) {
  const defaultOpen = detail.grupos.filter((g) => g.ordem === highlightOrdem).map((g) => String(g.ordem))

  return (
    <div className="space-y-4 py-2 text-left whitespace-normal">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{detail.nome}</span>
          <Badge variant="outline">{detail.tipo}</Badge>
          <span className="text-xs text-muted-foreground">#{detail.id}</span>
        </div>
        {detail.rotulo && <p className="text-xs text-muted-foreground">Rótulo: {detail.rotulo}</p>}
        <div className="flex flex-wrap gap-1.5">
          {detail.flags
            .filter((f) => f.ativo)
            .map((f) => (
              <Badge key={f.label} variant="success">
                {f.label}
              </Badge>
            ))}
        </div>
        {(detail.editadoPor || detail.atualizadoEm) && (
          <p className="text-xs text-muted-foreground">
            Editado por {dash(detail.editadoPor)} em {dash(detail.atualizadoEm)}
          </p>
        )}
        {detail.mensagemErro && <p className="text-xs text-destructive">Mensagem de erro: {detail.mensagemErro}</p>}
      </div>

      <LogicaText logica={detail.logica} />

      {detail.consulta && (
        <Section title="Consulta do componente">
          <p className="text-xs">
            <span className="font-mono">{detail.consulta.codigo}</span> — coligada {dash(detail.consulta.coligada)}, sistema {dash(detail.consulta.sistema)}
            {detail.consulta.usaCache ? `, cache ${detail.consulta.frequenciaCache ?? "ativo"}` : ""}
          </p>
          <ParametrosTable parametros={detail.consulta.parametros} />
        </Section>
      )}

      <Section title={`Button actions (${detail.grupos.length})`}>
        {detail.grupos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma ação configurada.</p>
        ) : (
          <Accordion defaultValue={defaultOpen} multiple>
            {detail.grupos.map((g) => (
              <AccordionItem key={g.id ?? g.ordem} value={String(g.ordem)} className={cn(g.ordem === highlightOrdem && "rounded-md bg-primary/5")}>
                <AccordionTrigger className="gap-1.5 px-2">
                  <span className="flex flex-1 flex-wrap items-center gap-1.5 text-left">
                    <span className="text-muted-foreground">{g.ordem + 1}.</span>
                    <span>{g.titulo}</span>
                    <Badge variant="outline">{g.tipoGrupo}</Badge>
                    <Badge variant="outline">{g.plano === "primeiro" ? "1º plano" : "2º plano"}</Badge>
                    {!g.ativa && <Badge variant="destructive">Inativa</Badge>}
                    {g.ordem === highlightOrdem && <Badge>Encontrada na busca</Badge>}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 px-2">
                  {g.mensagemErro && <p className="text-xs text-muted-foreground">Mensagem de erro: {g.mensagemErro}</p>}
                  {g.acoes.map((acao, i) => (
                    <ActionBlock key={acao.id ?? i} acao={acao} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Section>

      {detail.encaminhamentos.length > 0 && (
        <Section title={`Encaminhamentos (${detail.encaminhamentos.length})`}>
          <ul className="list-disc pl-5 text-xs">
            {detail.encaminhamentos.map((e, i) => (
              <li key={i}>
                {e.tipo}: {e.destino}
                {e.novaAba ? " (nova aba)" : ""}
                {e.parametros?.length ? ` — parâmetros: ${e.parametros.map((p) => `${p.nome} = ${p.campoSistema ?? p.valorFixo ?? "—"}`).join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
