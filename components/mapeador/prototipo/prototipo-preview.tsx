"use client"

import { Fragment, useState } from "react"
import { ChevronDown, Pencil } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { normalizeLargura, type MapeadorCampo, type MapeadorCampoLargura, type MapeadorProjetoDTO } from "@/types/mapeador"
import type { PrototipoScreen } from "@/components/mapeador/prototipo/screens"

const DEFAULT_BG =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=60"

const GRID_GAP_PX = 20
const LARGURA_PRESETS: { label: string; largura: MapeadorCampoLargura }[] = [
  { label: "25%", largura: 3 },
  { label: "33%", largura: 4 },
  { label: "50%", largura: 6 },
  { label: "100%", largura: 12 },
]

/** Illustrative-only enrollment details shown on the portal screen's "Detalhes da inscrição" card — there's no real candidate data to show in a prototype. */
const PORTAL_DETALHES_MOCK = [
  { label: "Curso", value: "Administração" },
  { label: "Modalidade", value: "Presencial" },
  { label: "Campus", value: "Sede" },
  { label: "Forma de Ingresso", value: "Vestibular Presencial" },
]

/** Width for an N/12 column span, discounting a share of the row gap so columns still line up flush — mirrors the fixed .p-span-* rules this replaces. */
function larguraStyle(largura: number): React.CSSProperties {
  const pct = (largura / 12) * 100
  const gapAdjust = GRID_GAP_PX * (1 - largura / 12)
  return { width: `calc(${pct}% - ${gapAdjust}px)` }
}

function isVoltarButton(label: string) {
  return /voltar/i.test(label)
}

interface EditableTextProps {
  id: string
  value: string
  editing: boolean
  onChange: (id: string, value: string) => void
  className?: string
  as?: "span" | "div"
}

function EditableText({ id, value, editing, onChange, className, as = "span" }: EditableTextProps) {
  const Tag = as
  if (!editing) return <Tag className={className}>{value}</Tag>
  return (
    <Tag
      className={cn(className, "p-edit-target rounded")}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(id, e.currentTarget.textContent || value)}
    >
      {value}
    </Tag>
  )
}

interface WidthPickerProps {
  value: MapeadorCampoLargura | undefined
  novaLinha: boolean | undefined
  onPickLargura: (largura: MapeadorCampoLargura) => void
  onToggleNovaLinha: (novaLinha: boolean) => void
  children: React.ReactNode
}

function WidthPicker({ value, novaLinha, onPickLargura, onToggleNovaLinha, children }: WidthPickerProps) {
  const [open, setOpen] = useState(false)
  const current = normalizeLargura(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger nativeButton={false} render={<div className="p-adjust-target rounded" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-row flex-wrap gap-1 p-1">
        {LARGURA_PRESETS.map((p) => (
          <button
            key={p.largura}
            type="button"
            className={cn(
              "rounded px-2 py-1 text-xs font-medium",
              current === p.largura ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
            onClick={() => {
              onPickLargura(p.largura)
              setOpen(false)
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "whitespace-nowrap rounded px-2 py-1 text-xs font-medium",
            novaLinha ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
          )}
          onClick={() => onToggleNovaLinha(!novaLinha)}
        >
          ↵ Nova linha
        </button>
      </PopoverContent>
    </Popover>
  )
}

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>CPF ou EMAIL*</Label>
            <Input />
          </div>
          <div className="space-y-1.5">
            <Label>Data de Nascimento*</Label>
            <Input type="date" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Acessar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PrototipoPreviewProps {
  screen: PrototipoScreen
  projetos: MapeadorProjetoDTO[]
  values: Record<string, unknown>
  errors: Set<string>
  setValue: (campoId: string, value: unknown) => void
  onBotaoClick: (campo: MapeadorCampo) => void
  onAdvanceFromPortal: () => void
  logoUrl?: string | null
  bgImageUrl?: string | null
  textos: Record<string, string>
  onTextoChange: (id: string, value: string) => void
  editingTextos: boolean
  adjustMode: boolean
  onLarguraChange: (campoId: string, largura: MapeadorCampoLargura) => void
  onNovaLinhaChange: (campoId: string, novaLinha: boolean) => void
}

export function PrototipoPreview({
  screen,
  projetos,
  values,
  errors,
  setValue,
  onBotaoClick,
  onAdvanceFromPortal,
  logoUrl,
  bgImageUrl,
  textos,
  onTextoChange,
  editingTextos,
  adjustMode,
  onLarguraChange,
  onNovaLinhaChange,
}: PrototipoPreviewProps) {
  const bg = bgImageUrl || DEFAULT_BG
  const t = (id: string, fallback: string) => textos[id] ?? fallback
  const [loginOpen, setLoginOpen] = useState(false)

  function isCampoVisible(campo: MapeadorCampo): boolean {
    if (!campo.condicaoRefCampoId) return true
    const refValue = values[campo.condicaoRefCampoId]
    const esperado = campo.condicaoRefValor
    if (typeof esperado === "boolean") return !!refValue === esperado
    if (Array.isArray(refValue)) return refValue.includes(esperado)
    return refValue === esperado
  }

  function renderCampo(campo: MapeadorCampo) {
    const hasError = errors.has(campo.id)
    const larguraCss = larguraStyle(normalizeLargura(campo.largura))

    let content: React.ReactNode
    switch (campo.tipo) {
      case "titulo_pagina":
        content = <div className="p-title-inline">{campo.label}</div>
        break
      case "label_destaque":
        content = <div className="p-label-inline">{campo.label}</div>
        break
      case "texto_informativo":
        content = <p className="p-info">{campo.label}</p>
        break
      case "divisor":
        content = <hr className="p-hr" />
        break
      case "botao":
        return (
          <button
            key={campo.id}
            className={cn("p-btn", isVoltarButton(campo.label) ? "ghost" : "solid")}
            onClick={() => onBotaoClick(campo)}
          >
            {campo.label.toUpperCase()}
          </button>
        )
      case "select":
        content = (
          <div className="p-fld">
            <label className="p-lbl">
              {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
            </label>
            <select className="p-ctl" value={(values[campo.id] as string) ?? ""} onChange={(e) => setValue(campo.id, e.target.value)}>
              <option value="" disabled>
                Selecionar
              </option>
              {(campo.opcoesLista ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )
        break
      case "radio":
        content = (
          <div className="p-fld">
            <label className="p-lbl">
              {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
            </label>
            <div className="p-radios">
              {(campo.opcoesLista ?? []).map((o) => (
                <label key={o} className="p-radio">
                  <span className={cn("p-dot", values[campo.id] === o && "on")} />
                  <input type="radio" className="sr-only" checked={values[campo.id] === o} onChange={() => setValue(campo.id, o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
        )
        break
      case "check": {
        if (campo.opcoesLista?.length) {
          const selected = (values[campo.id] as string[]) ?? []
          content = (
            <div className="p-fld">
              <label className="p-lbl">
                {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
              </label>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {campo.opcoesLista.map((o) => (
                  <label key={o} className="p-chk">
                    <span className={cn("p-box", selected.includes(o) && "on")}>{selected.includes(o) ? "✓" : ""}</span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected.includes(o)}
                      onChange={() => setValue(campo.id, selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o])}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          )
        } else {
          content = (
            <label className="p-chk">
              <span className={cn("p-box", !!values[campo.id] && "on")}>{values[campo.id] ? "✓" : ""}</span>
              <input type="checkbox" className="sr-only" checked={!!values[campo.id]} onChange={(e) => setValue(campo.id, e.target.checked)} />
              {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
            </label>
          )
        }
        break
      }
      case "data":
        content = (
          <div className="p-fld">
            <label className="p-lbl">
              {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
            </label>
            <input type="date" className="p-ctl" value={(values[campo.id] as string) ?? ""} onChange={(e) => setValue(campo.id, e.target.value)} />
          </div>
        )
        break
      case "documento_upload":
        content = (
          <div className="p-fld">
            <label className="p-lbl">
              {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
            </label>
            <input type="file" className="p-ctl" onChange={(e) => setValue(campo.id, e.target.files?.[0]?.name ?? "")} />
          </div>
        )
        break
      case "pagamento_valor":
        content = (
          <div className="p-money">
            <div className="p-mlbl">{campo.label}</div>
            <div className="p-mval">R$ 50,00</div>
          </div>
        )
        break
      case "pagamento_formas":
        content = (
          <div className="p-fld">
            <label className="p-lbl">{campo.label}</label>
            <div className="p-radios">
              {["Boleto", "Pix", "Cartão de crédito"].map((o) => (
                <label key={o} className="p-radio">
                  <span className={cn("p-dot", values[campo.id] === o && "on")} />
                  <input type="radio" className="sr-only" checked={values[campo.id] === o} onChange={() => setValue(campo.id, o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
        )
        break
      case "popup":
      case "condicional":
        content = <p className="p-info italic">{campo.label}</p>
        break
      default:
        content = (
          <div className="p-fld">
            <label className="p-lbl">
              {campo.label} {campo.obrigatorio && <span className="p-req">*</span>}
            </label>
            <input
              className="p-ctl"
              value={(values[campo.id] as string) ?? ""}
              onChange={(e) => setValue(campo.id, e.target.value)}
            />
          </div>
        )
    }

    const wrapped = adjustMode ? (
      <WidthPicker
        value={campo.largura}
        novaLinha={campo.novaLinha}
        onPickLargura={(l) => onLarguraChange(campo.id, l)}
        onToggleNovaLinha={(n) => onNovaLinhaChange(campo.id, n)}
      >
        {content}
      </WidthPicker>
    ) : (
      content
    )

    return (
      <Fragment key={campo.id}>
        {campo.novaLinha && <div aria-hidden className="h-0 basis-full" />}
        <div style={larguraCss} className={campo.novaLinha ? "mt-4" : undefined} data-error={hasError || undefined}>
          {wrapped}
        </div>
      </Fragment>
    )
  }

  if (screen.kind === "landing") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="p-topbar">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
          <button className="p-login" onClick={() => setLoginOpen(true)}>
            LOGIN
          </button>
        </div>
        <div
          className="flex min-h-[420px] flex-1 items-center justify-center p-10 text-center"
          style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)), url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="mx-auto max-w-md text-white">
            <h2 className="mb-4 text-2xl font-bold">Escolha o processo seletivo</h2>
            <label className="p-lbl !text-white text-left block">Selecione uma opção *</label>
            <select className="p-ctl mb-4" style={{ background: "#fff" }} disabled={projetos.length <= 1} defaultValue={projetos[0]?.id}>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <div>
              <button className="p-btn solid" onClick={onAdvanceFromPortal}>
                {t("btn.avancar", "AVANÇAR")}
              </button>
            </div>
          </div>
        </div>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </div>
    )
  }

  const projeto = projetos[screen.projetoIndex]
  const etapa = projeto?.etapas[screen.etapaIndex]

  if (screen.kind === "portal") {
    const etapasConcluidas = projeto?.etapas.slice(0, screen.etapaIndex + 1) ?? []
    const nextEtapa = projeto?.etapas[screen.etapaIndex + 1]
    const feedbackPositivo = etapa?.feedbacks.find((f) => f.tipo === "positivo")
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="p-topbar">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
          <button className="p-profile">
            Pedro <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-portal" style={{ backgroundImage: `url(${bg})` }}>
          <div className="w-72 space-y-4">
            <div className="p-card">
              <div className="p-card-title">Minhas inscrições</div>
              <div className="flex items-center justify-between">
                <div className="p-card-value">{projeto?.nome}</div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-card">
              <div className="mb-3 flex items-center justify-between">
                <div className="p-card-value">Detalhes da inscrição</div>
                <button className="p-btn ghost !shadow-none !bg-white border !px-2.5 !py-1.5 !text-xs">
                  <Pencil className="mr-1 inline h-3 w-3" /> Editar
                </button>
              </div>
              {PORTAL_DETALHES_MOCK.map((d) => (
                <div className="p-detail-row" key={d.label}>
                  <div className="p-detail-lbl">{d.label}</div>
                  <div className="p-detail-val">{d.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-card min-w-[320px] flex-1 !p-0 overflow-hidden">
            <div className="bg-[var(--brand)] p-4 text-center text-sm font-semibold text-white">
              <EditableText id="portal.titulo" value={t("portal.titulo", "Acompanhe aqui o status da sua inscrição")} editing={editingTextos} onChange={onTextoChange} />
            </div>
            <div className="space-y-0 p-5">
              {etapasConcluidas.map((e) => {
                const fb = e.feedbacks.find((f) => f.tipo === "positivo")
                return (
                  <div className="p-status-row" key={e.id}>
                    <span className="p-status-ic done">✓</span>
                    <div>
                      <div className="p-card-value">{e.nome}</div>
                      <div className="text-xs italic text-muted-foreground">{fb?.feedback || "Concluída"}</div>
                    </div>
                  </div>
                )
              })}
              {nextEtapa && (
                <div className="p-status-row justify-between">
                  <div className="flex items-center gap-3">
                    <span className="p-status-ic">!</span>
                    <div>
                      <div className="p-card-value">{nextEtapa.nome}</div>
                      <div className="text-xs italic text-muted-foreground">Aguardando conclusão</div>
                    </div>
                  </div>
                  {(feedbackPositivo?.botaoNoPortal ?? true) && (
                    <button className="p-btn ghost !shadow-none !bg-white border" onClick={onAdvanceFromPortal}>
                      {feedbackPositivo?.botaoLabel || "Acessar"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!etapa) return null
  const passo = etapa.camposPorEtapa[screen.passoIndex]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-topbar">
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
        <button className="p-login" onClick={() => setLoginOpen(true)}>
          LOGIN
        </button>
      </div>
      <div className="p-body">
        <div className="p-side" style={{ backgroundImage: `url(${bg})` }}>
          <div className="proc">{projeto.nome}</div>
          <div className="etapa">{etapa.nome}</div>
          <ul className="p-stepper">
            {etapa.camposPorEtapa.map((p, i) => (
              <li key={p.id} className={i > screen.passoIndex ? "todo" : undefined}>
                <span className={cn("ic", i < screen.passoIndex && "done")}>{i < screen.passoIndex ? "✓" : i + 1}</span>
                <div>
                  <div className="nm">{p.titulo}</div>
                  <div className="st">{i < screen.passoIndex ? "Concluído" : i === screen.passoIndex ? "Aguardando conclusão" : "Pendente"}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-main">
          {passo ? (
            <>
              <h2 className="p-h1">{passo.titulo}</h2>
              <div className="p-grid">{passo.campos.filter((c) => c.tipo !== "botao" && isCampoVisible(c)).map(renderCampo)}</div>
              <div className="p-actions">
                {passo.campos.filter((c) => c.tipo === "botao").length > 0 ? (
                  passo.campos.filter((c) => c.tipo === "botao").map(renderCampo)
                ) : (
                  <button className="p-btn solid ml-auto" onClick={() => onBotaoClick({ id: "__auto__", tipo: "botao", label: t("btn.avancar", "Avançar") })}>
                    {t("btn.avancar", "AVANÇAR")}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="p-info">Nenhum passo mapeado para esta etapa ainda. Vá até a aba Mapeamento para começar.</p>
          )}
        </div>
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}
