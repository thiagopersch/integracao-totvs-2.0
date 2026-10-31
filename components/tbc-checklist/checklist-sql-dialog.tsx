"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Download, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollableTabsList, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CodeEditor } from "@/components/shared/code-editor"
import { generateChecklistSql, type ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { downloadBlob } from "@/lib/ps-docs/download-utils"
import { SQL_DIALECT_LABELS, SQL_DIALECTS, type SqlDialect } from "@/lib/tbc-checklist-sql-dialect"
import type { ChecklistSqlFile, ChecklistSqlResult } from "@/lib/tbc-checklist-sql"
import type { TbcChecklistView } from "@/services/tbc-checklist.service"

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string; permissionDenied: boolean }
  | { status: "loaded"; result: ChecklistSqlResult }

interface ChecklistSqlDialogProps {
  tbcId: string
  checklist: TbcChecklistView
  /** Contexto of the GetSchema calls — the processo on screen's, else the checklist's saved one. */
  context?: ChecklistContext
  onOpenChange: (open: boolean) => void
}

/**
 * The RB.PS.VALIDA.1–4 Consultas SQL of the checklist, in Oracle and SQL Server, to register in the
 * client's RM for the Rubeus checklist page. Mounted only while open, so every opening reads the
 * Data Servers' schema (and the checklist's fields) fresh.
 */
export function ChecklistSqlDialog({ tbcId, checklist, context, onOpenChange }: ChecklistSqlDialogProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [dialect, setDialect] = useState<SqlDialect>("oracle")
  const [fileCode, setFileCode] = useState("")

  useEffect(() => {
    let cancelled = false
    void generateChecklistSql({ tbcId, checklistId: checklist.id, context }).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setState({ status: "error", error: result.error, permissionDenied: result.permissionDenied })
        return
      }
      setState({ status: "loaded", result: { files: result.files, warnings: result.warnings } })
      setFileCode(result.files.oracle[0]?.code ?? "")
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generated once per opening
  }, [tbcId, checklist.id])

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SQL do checklist &quot;{checklist.name}&quot;</DialogTitle>
          <DialogDescription>
            Consultas para cadastrar nas Consultas SQL do RM. A nº 1 não tem parâmetro; a nº 2 e a nº 3 usam :CODCOLIGADA e :IDPS; a nº 4
            usa também :IDAREAINTERESSE.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col">
          {state.status === "loading" && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-[50vh] w-full" />
            </div>
          )}

          {state.status === "error" && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              {state.permissionDenied ? <ShieldAlert /> : <AlertTriangle />}
              <AlertTitle>{state.permissionDenied ? "Sem permissão no TOTVS" : "Não foi possível gerar a SQL"}</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state.status === "loaded" && (
            <>
              {state.result.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>Confira antes de cadastrar</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {state.result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Tabs value={dialect} onValueChange={(v) => setDialect(v as SqlDialect)} className="min-h-0 flex-1">
                <TabsList>
                  {SQL_DIALECTS.map((d) => (
                    <TabsTrigger key={d} value={d}>
                      {SQL_DIALECT_LABELS[d]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {SQL_DIALECTS.map((d) => (
                  <TabsContent key={d} value={d} className="flex min-h-0 flex-col gap-2 pt-2">
                    <Tabs value={fileCode} onValueChange={(v) => setFileCode(String(v))} className="min-h-0 flex-1">
                      <ScrollableTabsList>
                        {state.result.files[d].map((file) => (
                          <TabsTrigger key={file.code} value={file.code}>
                            {file.code}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                      {state.result.files[d].map((file) => (
                        <TabsContent key={file.code} value={file.code} className="flex min-h-0 flex-col gap-2 pt-2">
                          <SqlFileView file={file} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function SqlFileView({ file }: { file: ChecklistSqlFile }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {file.code} - {file.title}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadBlob(new Blob([file.sql], { type: "text/plain;charset=utf-8" }), file.fileName)}
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar .sql
        </Button>
      </div>
      <CodeEditor value={file.sql} language="sql" readOnly resetKey={file.fileName} minHeight="50vh" />
    </>
  )
}
