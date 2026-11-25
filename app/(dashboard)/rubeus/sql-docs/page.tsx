"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ClipboardPaste, Database, FileUp, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { getSqlDocsPageData } from "@/actions/integrations/sql-docs"
import { StylePanel } from "@/components/ps-docs/style-panel"
import { SqlDocResult } from "@/components/sql-docs/sql-doc-result"
import { SqlQueryInputCard } from "@/components/sql-docs/sql-query-input-card"
import { codeAndTitleFromFileName, newQueryItem, type QueryItem, type SentenceOption } from "@/components/sql-docs/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_STYLE, type StyleConfig } from "@/lib/ps-docs/types"
import {
  DEFAULT_SQL_DOC_OPTIONS,
  DEFAULT_SQL_DOC_SUBTITLE,
  DEFAULT_SQL_DOC_TITLE,
  type SqlDocEntry,
  type SqlDocOptions,
  type SqlDocument,
} from "@/lib/sql-docs/types"
import { toast } from "@/lib/toast"

type AnalyzeResult = { success: true; entry: SqlDocEntry } | { success: false; error: string }

/** Calls the streaming analysis route; `onProgress` gets the number of characters written so far. */
async function analyzeQuery(item: QueryItem, onProgress: (chars: number) => void): Promise<AnalyzeResult> {
  const response = await fetch("/api/sql-docs/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: item.id, code: item.code, title: item.title, sql: item.sql }),
  })
  if (!response.body) return { success: false, error: `Falha na análise (HTTP ${response.status})` }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let chars = 0
  let result: AnalyzeResult | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: !done })
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0 || (done && buffer.trim())) {
      const line = nl >= 0 ? buffer.slice(0, nl) : buffer
      buffer = nl >= 0 ? buffer.slice(nl + 1) : ""
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line) as { type: string; chunk?: string; result?: AnalyzeResult }
        if (event.type === "delta" && event.chunk) onProgress((chars += event.chunk.length))
        if (event.type === "done" && event.result) result = event.result
      } catch {
        // Partial line — wait for the rest.
      }
    }
    if (done) break
  }
  return result ?? { success: false, error: "A análise foi interrompida — tente novamente." }
}

export default function SqlDocsPage() {
  const [docTitle, setDocTitle] = useState(DEFAULT_SQL_DOC_TITLE)
  const [docSubtitle, setDocSubtitle] = useState(DEFAULT_SQL_DOC_SUBTITLE)
  const [items, setItems] = useState<QueryItem[]>(() => [newQueryItem("upload")])
  const [options, setOptions] = useState<SqlDocOptions>(DEFAULT_SQL_DOC_OPTIONS)
  const [style, setStyle] = useState<StyleConfig>(DEFAULT_STYLE)
  const [running, setRunning] = useState(false)
  const [pageData, setPageData] = useState<{ sentences: SentenceOption[]; dictionaryRows: number } | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const filesRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSqlDocsPageData().then((res) => (res.success ? setPageData({ sentences: res.sentences, dictionaryRows: res.dictionaryRows }) : setPageError(res.error)))
  }, [])

  const patchItem = (id: string, patch: Partial<QueryItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const added = await Promise.all(
      [...files].map(async (file) => newQueryItem("upload", { fileName: file.name, sql: await file.text(), ...codeAndTitleFromFileName(file.name) }))
    )
    // Replace the initial empty card instead of leaving it dangling above the files.
    setItems((list) => [...list.filter((i) => i.sql.trim() || i.code || i.title), ...added])
  }

  async function runAnalysis(targets: QueryItem[]) {
    const valid = targets.filter((i) => i.sql.trim())
    if (valid.length === 0) {
      toast.error("Informe o SQL de pelo menos uma consulta")
      return
    }
    setRunning(true)
    // One at a time: each call already takes a while and the cards show their own progress.
    for (const item of valid) {
      patchItem(item.id, { status: "analyzing", error: undefined, progressChars: 0 })
      try {
        const res = await analyzeQuery(item, (chars) => patchItem(item.id, { progressChars: chars }))
        if (res.success) {
          setItems((list) =>
            list.map((i) => (i.id === item.id ? { ...i, status: "done", entry: res.entry, title: i.title.trim() || res.entry.title, rulesText: res.entry.rules.join("\n") } : i))
          )
        } else {
          patchItem(item.id, { status: "error", error: res.error })
        }
      } catch (error) {
        patchItem(item.id, { status: "error", error: (error as Error).message || "Falha de rede na análise" })
      }
    }
    setRunning(false)
  }

  const doc: SqlDocument | null = useMemo(() => {
    const entries = items
      .filter((i) => i.status === "done" && i.entry)
      .map((i) => ({
        ...i.entry!,
        code: i.code.trim(),
        title: i.title.trim() || i.entry!.title,
        sql: i.sql,
        rules: i.rulesText
          .split("\n")
          .map((r) => r.replace(/^\s*[-•*]\s*/, "").trim())
          .filter(Boolean),
      }))
    return entries.length ? { title: docTitle.trim() || DEFAULT_SQL_DOC_TITLE, subtitle: docSubtitle.trim(), entries } : null
  }, [items, docTitle, docSubtitle])

  const doneCount = items.filter((i) => i.status === "done").length
  const analyzingIndex = items.findIndex((i) => i.status === "analyzing")
  const withSql = items.filter((i) => i.sql.trim())
  const pending = withSql.filter((i) => i.status !== "done")
  // Everything with SQL is already documented: the main button regenerates all of it.
  const regenerate = doneCount > 0 && pending.length === 0
  const canUseSentences = (pageData?.sentences.length ?? 0) > 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-5 w-5" /> Documentar consultas
        </h1>
        <p className="text-sm text-muted-foreground">
          Anexe arquivos .sql, cole o SQL ou escolha sentenças cadastradas. A IA identifica as tabelas, os campos e as regras de cada consulta, usando o
          dicionário de dados TOTVS, e gera a documentação técnica no padrão do mapeamento de consultas.
        </p>
      </div>

      {pageError && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{pageError}</CardContent>
        </Card>
      )}
      {pageData && pageData.dictionaryRows === 0 && (
        <Card>
          <CardContent className="pt-6 flex gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              O dicionário de dados TOTVS ainda não foi importado — a análise funciona, mas sem as descrições oficiais das tabelas e campos. Importe a planilha
              em{" "}
              <Link href="/totvs/dictionary" className="text-primary underline underline-offset-2">
                TOTVS RM › Catálogo RM › Dicionário de dados
              </Link>
              .
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="doc-title">Título do documento</FieldLabel>
              <Input id="doc-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="[RB-34] [CLIENTE] - Documentação técnica: Mapeamento de consultas" />
            </Field>
            <Field>
              <FieldLabel htmlFor="doc-subtitle">Subtítulo</FieldLabel>
              <Input id="doc-subtitle" value={docSubtitle} onChange={(e) => setDocSubtitle(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {(
              [
                ["includeSummary", "Incluir resumo de cada consulta"],
                ["includeTables", "Incluir parâmetros, tabelas e campos utilizados"],
                ["includeSql", "Incluir a sentença SQL"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 cursor-pointer">
                <Switch size="sm" checked={options[key]} onCheckedChange={(v) => setOptions((o) => ({ ...o, [key]: v }))} />
                {label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {!pageData && !pageError ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        items.map((item, index) => (
          <SqlQueryInputCard
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            sentences={pageData?.sentences ?? []}
            canUseSentences={canUseSentences || item.source === "sentence"}
            disabled={running}
            onChange={(patch) => patchItem(item.id, patch)}
            onRemove={() => setItems((list) => (list.length > 1 ? list.filter((i) => i.id !== item.id) : [newQueryItem("upload")]))}
            onMove={(delta) =>
              setItems((list) => {
                const next = [...list]
                const to = index + delta
                if (to < 0 || to >= next.length) return list
                ;[next[index], next[to]] = [next[to], next[index]]
                return next
              })
            }
            onRetry={() => void runAnalysis([item])}
          />
        ))
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <input ref={filesRef} type="file" accept=".sql,.txt,text/plain,application/sql" multiple hidden onChange={(e) => void addFiles(e.target.files).finally(() => (e.target.value = ""))} />
        <Button type="button" variant="outline" size="sm" disabled={running} onClick={() => filesRef.current?.click()}>
          <FileUp className="h-4 w-4 mr-2" /> Anexar arquivos .sql
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={running} onClick={() => setItems((l) => [...l, newQueryItem("paste")])}>
          <ClipboardPaste className="h-4 w-4 mr-2" /> Colar SQL
        </Button>
        {canUseSentences && (
          <Button type="button" variant="outline" size="sm" disabled={running} onClick={() => setItems((l) => [...l, newQueryItem("sentence")])}>
            <Database className="h-4 w-4 mr-2" /> Sentença cadastrada
          </Button>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          size="lg"
          disabled={running || withSql.length === 0}
          onClick={() => void runAnalysis(regenerate ? withSql : pending)}
          sx={{ px: 4, borderRadius: 6 }}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : regenerate ? (
            <RotateCcw className="h-4 w-4 mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {regenerate
            ? "Regerar documentação"
            : doneCount > 0
              ? `Gerar documentação das ${pending.length} pendente(s)`
              : "Gerar documentação"}
        </Button>
        {running && (
          <div className="w-full max-w-xs space-y-1">
            <Progress value={(doneCount / Math.max(items.filter((i) => i.sql.trim()).length, 1)) * 100} />
            <p className="text-xs text-muted-foreground text-center">
              Analisando consulta {analyzingIndex + 1} de {items.length}…
            </p>
          </div>
        )}
      </div>

      {doc && (
        <>
          <StylePanel style={style} onChange={setStyle} />
          <SqlDocResult doc={doc} style={style} options={options} />
        </>
      )}
    </div>
  )
}
