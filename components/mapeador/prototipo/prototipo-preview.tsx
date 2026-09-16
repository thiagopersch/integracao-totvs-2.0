"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { normalizeLargura, type MapeadorCampo, type MapeadorCampoLargura, type MapeadorProjetoDTO } from "@/types/mapeador"
import type { PrototipoScreen } from "@/components/mapeador/prototipo/screens"

const DEFAULT_BG =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=60"

const GRID_GAP_PX = 20
const LARGURA_OPCOES = Array.from({ length: 12 }, (_, i) => 12 - i)

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
  onPick: (largura: MapeadorCampoLargura) => void
  children: React.ReactNode
}

function WidthPicker({ value, onPick, children }: WidthPickerProps) {
  const [open, setOpen] = useState(false)
  const current = normalizeLargura(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger nativeButton={false} render={<div className="p-adjust-target rounded" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <label className="mb-1 block text-xs text-muted-foreground">Largura (colunas de 12)</label>
        <select
          className="rounded border bg-background p-1 text-xs"
          value={current}
          onChange={(e) => {
            onPick(Number(e.target.value))
            setOpen(false)
          }}
        >
          {LARGURA_OPCOES.map((n) => (
            <option key={n} value={n}>
              {n} ({Math.round((n / 12) * 100)}%)
            </option>
          ))}
        </select>
      </PopoverContent>
    </Popover>
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
}: PrototipoPreviewProps) {
  const bg = bgImageUrl || DEFAULT_BG
  const t = (id: string, fallback: string) => textos[id] ?? fallback

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
      <WidthPicker value={campo.largura} onPick={(l) => onLarguraChange(campo.id, l)}>
        {content}
      </WidthPicker>
    ) : (
      content
    )

    return (
      <div key={campo.id} style={larguraCss} data-error={hasError || undefined}>
        {wrapped}
      </div>
    )
  }

  if (screen.kind === "landing") {
    return (
      <div>
        <div className="p-topbar">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
          <button className="p-login">LOGIN</button>
        </div>
        <div
          className="flex min-h-[420px] items-center justify-center p-10 text-center"
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
      </div>
    )
  }

  const projeto = projetos[screen.projetoIndex]
  const etapa = projeto?.etapas[screen.etapaIndex]

  if (screen.kind === "portal") {
    const nextEtapa = projeto?.etapas[screen.etapaIndex + 1]
    const feedbackPositivo = etapa?.feedbacks.find((f) => f.tipo === "positivo")
    const statusLabel = feedbackPositivo?.feedback || "Concluída"
    return (
      <div>
        <div className="p-topbar">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
          <button className="p-login">Pedro ⌄</button>
        </div>
        <div className="p-portal" style={{ backgroundImage: `url(${bg})` }}>
          <div className="p-card w-72">
            <div className="p-card-title">Minhas inscrições</div>
            <div className="p-card-value">{projeto?.nome}</div>
          </div>
          <div className="p-card min-w-[320px] flex-1 !p-0 overflow-hidden">
            <div className="bg-[var(--brand)] p-4 text-center text-sm font-semibold text-white">
              <EditableText id="portal.titulo" value={t("portal.titulo", "Acompanhe aqui o status da sua inscrição")} editing={editingTextos} onChange={onTextoChange} />
            </div>
            <div className="space-y-0 p-5">
              <div className="p-status-row">
                <span className="p-status-ic done">✓</span>
                <div>
                  <div className="p-card-value">{etapa?.nome}</div>
                  <div className="text-xs italic text-muted-foreground">{statusLabel}</div>
                </div>
              </div>
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
    <div>
      <div className="p-topbar">
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
        <button className="p-login">LOGIN</button>
      </div>
      <div className="p-body">
        <div className="p-side" style={{ backgroundImage: `url(${bg})` }}>
          <div className="proc">{projeto.nome}</div>
          <div className="etapa">{etapa.nome}</div>
          <ul className="p-stepper">
            {projeto.etapas.map((e, i) => (
              <li key={e.id} className={i > screen.etapaIndex ? "todo" : undefined}>
                <span className={cn("ic", i < screen.etapaIndex && "done")}>{i < screen.etapaIndex ? "✓" : i + 1}</span>
                <div>
                  <div className="nm">{e.nome}</div>
                  <div className="st">{i < screen.etapaIndex ? "Concluído" : i === screen.etapaIndex ? "Aguardando conclusão" : "Pendente"}</div>
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
    </div>
  )
}
