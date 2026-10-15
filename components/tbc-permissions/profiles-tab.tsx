"use client"

import { useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, Download, FileUp, Loader2, Settings2, Users } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/shared/data-table"
import { downloadCsv } from "@/components/tbc-permissions/csv"
import { PermissionSentenceDialog } from "@/components/tbc-permissions/permission-sentence-dialog"
import {
  fetchTbcUserProfiles,
  readPermissionReports,
  type TbcUserProfileLink,
} from "@/actions/integrations/tbc-permissions"
import { RM_SYSTEM_NAMES } from "@/config/tbc-permission-models"
import type { PermissionModel, ReferenceProfile } from "@/config/tbc-permission-models/types"
import {
  compareCodes,
  diffProfile,
  matchReportProfiles,
  type AccessDiffRow,
  type AccessDiffStatus,
} from "@/lib/tbc-permission-compare"
import type { ParsedReportProfile } from "@/lib/tbc-permission-report"
import type { TbcRow } from "@/services/tbc.service"

type UploadedProfile = ParsedReportProfile & { fileName: string }
type SortState = { field: string; direction: "asc" | "desc" }

type LinksState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; links: TbcUserProfileLink[] }
  | { status: "error"; error: string; sentenceMissing: boolean }

const DIFF_LABELS: Record<AccessDiffStatus, string> = { ok: "Liberado", missing: "Faltando", extra: "A mais" }
const DIFF_VARIANT = { ok: "success", missing: "destructive", extra: "secondary" } as const
/** Select value for "no uploaded profile chosen". */
const NONE = "none"

interface ProfilesTabProps {
  tbc: TbcRow
  model: PermissionModel
}

/**
 * Two checks per reference profile of the model: which RM profiles the TBC user is linked to
 * (Consulta SQL on GPERMIS/GUSRPERFIL), and a code-by-code comparison of the client's
 * "Relatório de permissões dos perfis" PDFs against the reference menu accesses.
 */
export function ProfilesTab({ tbc, model }: ProfilesTabProps) {
  const [links, setLinks] = useState<LinksState>({ status: "idle" })
  const [sentenceOpen, setSentenceOpen] = useState(false)
  const [uploaded, setUploaded] = useState<UploadedProfile[]>([])
  const [uploading, setUploading] = useState(false)
  // reference profile key → index in `uploaded` (auto-matched, overridable in the select).
  const [assignment, setAssignment] = useState<Record<string, number | undefined>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const systems = useMemo(() => [...new Set(model.profiles.map((p) => p.codSistema))], [model])

  const diffs = useMemo(
    () =>
      Object.fromEntries(
        model.profiles.map((ref) => {
          const index = assignment[ref.key]
          return [ref.key, index === undefined ? null : diffProfile(ref, uploaded[index])]
        })
      ),
    [model, assignment, uploaded]
  )

  async function loadLinks() {
    setLinks({ status: "loading" })
    const res = await fetchTbcUserProfiles({ tbcId: tbc.id })
    if (res.success) setLinks({ status: "loaded", links: res.links })
    else setLinks({ status: "error", error: res.error, sentenceMissing: res.sentenceMissing })
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const formData = new FormData()
    for (const file of Array.from(files)) formData.append("files", file)
    setUploading(true)
    try {
      const res = await readPermissionReports(formData)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      for (const skipped of res.skipped) toast.warning(`Ignorado: ${skipped}`)
      if (!res.profiles.length) return
      const next = [...uploaded, ...res.profiles]
      setUploaded(next)
      setAssignment(matchReportProfiles(model.profiles, next))
      toast.success(`${res.profiles.length} perfil(is) lido(s) do relatório.`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function clearReports() {
    setUploaded([])
    setAssignment({})
  }

  function exportCsv() {
    const rows = model.profiles.flatMap((ref) => {
      const index = assignment[ref.key]
      const diff = diffs[ref.key]
      if (!diff || index === undefined) {
        return [[model.label, ref.label, ref.codSistema, "", "", "", "Relatório não enviado"]]
      }
      return diff.rows.map((r) => [model.label, ref.label, ref.codSistema, uploaded[index].codPerfil, r.code, r.label, DIFF_LABELS[r.status]])
    })
    downloadCsv(["Modelo", "Perfil de referência", "Sistema", "Perfil do cliente", "Código", "Menu", "Status"], rows, `permissoes-${model.key}-${tbc.name}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Perfis do usuário {tbc.user}</h2>
            <p className="text-xs text-muted-foreground">Consulta SQL no RM do cliente: a quais perfis o usuário do TBC está vinculado em cada sistema.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSentenceOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Como configurar
            </Button>
            <Button size="sm" onClick={loadLinks} disabled={links.status === "loading"}>
              {links.status === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              Consultar perfis
            </Button>
          </div>
        </div>
        {links.status === "error" && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle />
            <AlertTitle>{links.sentenceMissing ? "Consulta SQL não cadastrada no RM" : "Falha ao consultar os perfis"}</AlertTitle>
            <AlertDescription>
              <p>{links.sentenceMissing ? "Cadastre a consulta no RM do cliente e tente de novo." : links.error}</p>
              <Button variant="link" className="h-auto p-0" onClick={() => setSentenceOpen(true)}>
                Ver como configurar
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {links.status === "loaded" && (
          <div className="grid gap-2 sm:grid-cols-3">
            {systems.map((sys) => (
              <SystemLinks key={sys} codSistema={sys} links={links.links.filter((l) => l.codSistema === sys)} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Menus liberados × modelo {model.label}</h2>
            <p className="text-xs text-muted-foreground">
              Envie o &quot;Relatório de permissões dos perfis&quot; gerado no RM do cliente (um PDF por perfil ou vários perfis no mesmo PDF).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploaded.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={clearReports}>
                  Limpar
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Enviar relatórios
            </Button>
          </div>
        </div>

        <Tabs defaultValue={model.profiles[0]?.key}>
          <TabsList className="flex-wrap">
            {model.profiles.map((ref) => {
              const diff = diffs[ref.key]
              return (
                <TabsTrigger key={ref.key} value={ref.key}>
                  {ref.label}
                  {diff && (
                    <Badge variant={diff.missing ? "destructive" : "success"} className="ml-1">
                      {diff.missing ? `${diff.missing} faltando` : "OK"}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {model.profiles.map((ref) => (
            <TabsContent key={ref.key} value={ref.key} className="pt-3">
              <ReferenceProfilePanel
                reference={ref}
                uploaded={uploaded}
                selected={assignment[ref.key]}
                onSelect={(index) => setAssignment((prev) => ({ ...prev, [ref.key]: index }))}
                links={links.status === "loaded" ? links.links : null}
              />
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <PermissionSentenceDialog open={sentenceOpen} onOpenChange={setSentenceOpen} />
    </div>
  )
}

function SystemLinks({ codSistema, links }: { codSistema: string; links: TbcUserProfileLink[] }) {
  const name = RM_SYSTEM_NAMES[codSistema] ?? codSistema
  const supervisor = links.some((l) => l.supervisor)
  const profiles = links.filter((l) => l.codPerfil)

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{name}</span>
        {!links.length ? (
          <Badge variant="destructive">Sem acesso</Badge>
        ) : supervisor ? (
          <Badge variant="secondary">Supervisor</Badge>
        ) : profiles.length ? (
          <Badge variant="success">Com perfil</Badge>
        ) : (
          <Badge variant="destructive">Sem perfil</Badge>
        )}
      </div>
      {profiles.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {profiles.map((l) => (
            <li key={`${l.codColigada}-${l.codPerfil}`}>
              Coligada {l.codColigada}: <span className="font-mono text-foreground">{l.codPerfil}</span>
              {l.nomePerfil && ` — ${l.nomePerfil}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {links.length ? "Acesso ao sistema sem perfil vinculado." : "O usuário do TBC não tem acesso a este sistema."}
        </p>
      )}
    </div>
  )
}

interface ReferenceProfilePanelProps {
  reference: ReferenceProfile
  uploaded: UploadedProfile[]
  selected: number | undefined
  onSelect: (index: number | undefined) => void
  links: TbcUserProfileLink[] | null
}

function ReferenceProfilePanel({ reference, uploaded, selected, onSelect, links }: ReferenceProfilePanelProps) {
  const [statusFilter, setStatusFilter] = useState<AccessDiffStatus | "">("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({ field: "code", direction: "asc" })

  const options = uploaded
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p.codSistema === null || p.codSistema === reference.codSistema)
  const actual = selected === undefined ? null : uploaded[selected]
  const diff = useMemo(() => (actual ? diffProfile(reference, actual) : null), [reference, actual])

  // The uploaded report is of a profile the TBC user isn't linked to — the comparison then says
  // nothing about what the integration can actually do.
  const notLinked =
    actual &&
    links &&
    !links.some((l) => l.codSistema === reference.codSistema && l.codPerfil?.toLowerCase() === actual.codPerfil.toLowerCase())

  const rows = useMemo(() => {
    if (!diff) return []
    const term = search.trim().toLowerCase()
    const list = diff.rows
      .filter((r) => !statusFilter || r.status === statusFilter)
      .filter((r) => !term || r.code.includes(term) || r.label.toLowerCase().includes(term))
    const dir = sort.direction === "asc" ? 1 : -1
    const cmp = (a: AccessDiffRow, b: AccessDiffRow) =>
      sort.field === "code"
        ? compareCodes(a.code, b.code)
        : sort.field === "status"
          ? DIFF_LABELS[a.status].localeCompare(DIFF_LABELS[b.status], "pt-BR")
          : a.label.localeCompare(b.label, "pt-BR")
    return [...list].sort((a, b) => cmp(a, b) * dir)
  }, [diff, statusFilter, search, sort])

  const columns: ColumnDef<AccessDiffRow>[] = [
    {
      accessorKey: "code",
      header: "Código",
      cell: ({ row }) => (
        <span className="font-mono text-xs" style={{ paddingLeft: `${(row.original.code.split(".").length - 1) * 0.75}rem` }}>
          {row.original.code}
        </span>
      ),
    },
    { accessorKey: "label", header: "Menu" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={DIFF_VARIANT[row.original.status]}>{DIFF_LABELS[row.original.status]}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">Sistema:</span> {RM_SYSTEM_NAMES[reference.codSistema] ?? reference.codSistema} ·{" "}
            <span className="text-muted-foreground">Modelo:</span> {reference.accesses.length} menus ({reference.source})
          </p>
        </div>
        <Select
          items={[{ value: NONE, label: "Nenhum relatório" }, ...options.map(({ p, index }) => ({ value: String(index), label: `${p.codPerfil} — ${p.nomePerfil}` }))]}
          value={selected === undefined ? NONE : String(selected)}
          onValueChange={(v) => onSelect(!v || v === NONE ? undefined : Number(v))}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Perfil do cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhum relatório</SelectItem>
            {options.map(({ p, index }) => (
              <SelectItem key={index} value={String(index)}>
                {p.codPerfil} — {p.nomePerfil}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!diff ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {options.length
            ? "Escolha qual perfil do cliente corresponde a este perfil do modelo."
            : `Envie o relatório do perfil do cliente equivalente a "${reference.label}" (sugestão: ${reference.suggestedCodPerfil}).`}
        </div>
      ) : (
        <>
          {notLinked && (
            <Alert>
              <AlertTriangle />
              <AlertTitle>Perfil não vinculado ao usuário do TBC</AlertTitle>
              <AlertDescription>
                O relatório é do perfil &quot;{actual!.codPerfil}&quot;, mas o usuário do TBC não está vinculado a ele neste sistema.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Cobertura {Math.round(diff.coverage * 100)}%</Badge>
            {(["ok", "missing", "extra"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter((prev) => (prev === s ? "" : s))}
              >
                {DIFF_LABELS[s]}: {diff[s]}
              </Button>
            ))}
          </div>
          <DataTable
            columns={columns}
            data={rows}
            pageSize={50}
            searchPlaceholder="Buscar por código ou menu..."
            onSearch={setSearch}
            sort={sort}
            onSortChange={setSort}
            sortableColumns={["code", "label", "status"]}
            emptyMessage="Nenhum menu para o filtro aplicado."
          />
        </>
      )}
    </div>
  )
}
