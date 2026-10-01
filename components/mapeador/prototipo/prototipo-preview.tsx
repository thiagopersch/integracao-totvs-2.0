"use client"

import { Fragment, useRef, useState } from "react"
import { ChevronDown, FileText, Pencil, Upload, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  normalizeLargura,
  DEFAULT_DETALHES_CAMPOS,
  type MapeadorCampo,
  type MapeadorCampoLargura,
  type MapeadorDetalhesInscricaoConfig,
  type MapeadorEtapaDTO,
  type MapeadorPasso,
  type MapeadorProjetoDTO,
} from "@/types/mapeador"
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

/** Picks the feedback that represents "what happened" for an already-completed etapa in the portal timeline: the configured positivo outcome, or whichever was configured first. */
function pickFeedback(etapa: MapeadorEtapaDTO) {
  return etapa.feedbacks.find((f) => f.tipo === "positivo") ?? etapa.feedbacks[0]
}

interface StatusRowTooltipProps {
  etapa: MapeadorEtapaDTO
  currentFeedback?: string
  children: React.ReactNode
}

/** Hover tooltip listing every configured feedback (with its logic) for an etapa shown in the portal timeline — only rendered when at least one feedback has a logic worth explaining. */
function StatusRowTooltip({ etapa, currentFeedback, children }: StatusRowTooltipProps) {
  const comLogica = etapa.feedbacks.filter((f) => f.logic?.trim())
  if (!comLogica.length) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-help underline decoration-dotted underline-offset-2" />}>{children}</TooltipTrigger>
      <TooltipContent className="w-72 max-w-72 flex-col items-start gap-0 p-0" side="top">
        <div className="w-full border-b border-background/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {comLogica.length} situações possíveis nesta etapa
        </div>
        <div className="w-full divide-y divide-background/20">
          {comLogica.map((f, i) => (
            <div key={i} className="px-3 py-2">
              <div className="text-sm font-semibold">
                {f.feedback}
                {f.feedback === currentFeedback && <span className="ml-1 font-normal opacity-70">· exibido agora</span>}
              </div>
              <div className="text-xs opacity-80">{f.logic}</div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
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

interface PopupCampoDialogProps {
  passo: MapeadorPasso | null
  onClose: () => void
  renderCampo: (campo: MapeadorCampo) => React.ReactNode
  container: React.RefObject<HTMLElement | null>
}

/** Opens a passo marked tipo "popup" as a modal — triggered by a botao campo whose acaoBotao is "popup". Reuses the same renderCampo closure as the surrounding screen so popup fields behave identically to normal form fields. */
function PopupCampoDialog({ passo, onClose, renderCampo, container }: PopupCampoDialogProps) {
  return (
    <Dialog open={!!passo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent container={container} className="h-auto max-h-[85vh] w-auto max-w-xl">
        <DialogHeader>
          <DialogTitle>{passo?.titulo || "Pop-up"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="p-grid">{passo?.campos.filter((c) => c.tipo !== "botao").map(renderCampo)}</div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DownloadToastProps {
  nomeArquivo: string
  onClose: () => void
  onOpenPreview: () => void
}

/** Mimics a browser/portal "recent downloads" notification — appears after a botao campo with acaoBotao "download" is clicked. Clicking the file name opens DocumentoPreviewDialog. */
function DownloadToast({ nomeArquivo, onClose, onOpenPreview }: DownloadToastProps) {
  return (
    <div className="p-download-toast">
      <div className="hdr">
        <span>Histórico de downloads recentes</span>
        <button type="button" className="close" onClick={onClose} aria-label="Fechar notificação">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="row">
        <span className="ic">
          <FileText className="h-4 w-4" />
        </span>
        <div className="p-upload-txt">
          <button type="button" className="nm" onClick={onOpenPreview}>
            {nomeArquivo}
          </button>
          <div className="meta">1 MB · Concluído</div>
        </div>
      </div>
      <a className="link" href="#" onClick={(e) => e.preventDefault()}>
        Histórico completo de downloads ↗
      </a>
    </div>
  )
}

interface DownloadSuccessDialogProps {
  open: boolean
  mensagem: string
  onClose: () => void
  onContinuar: () => void
  container: React.RefObject<HTMLElement | null>
}

function DownloadSuccessDialog({ open, mensagem, onClose, onContinuar, container }: DownloadSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent container={container} className="h-auto max-h-[85vh] w-auto max-w-md">
        <DialogHeader>
          <DialogTitle>{mensagem}</DialogTitle>
          <DialogDescription>Download realizado com sucesso, caso precise, você poderá voltar e baixar novamente.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onContinuar}>Portal do candidato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DocumentoPreviewDialogProps {
  open: boolean
  nomeArquivo: string
  onClose: () => void
  container: React.RefObject<HTMLElement | null>
}

/** Generic illustrative "paper" preview — reusable for any simulated file/report download, not boleto-specific. */
function DocumentoPreviewDialog({ open, nomeArquivo, onClose, container }: DocumentoPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent container={container} className="h-auto max-h-[85vh] w-auto max-w-md">
        <DialogHeader>
          <DialogTitle>{nomeArquivo}</DialogTitle>
        </DialogHeader>
        <DialogBody className="p-doc-preview">
          <div className="banner">Documento ilustrativo — sem valor fiscal, gerado só para demonstração</div>
          <div className="linha" style={{ width: "60%" }} />
          <div className="linha" />
          <div className="linha" />
          <div className="linha" style={{ width: "40%" }} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
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
  detalhesInscricao?: MapeadorDetalhesInscricaoConfig
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
  detalhesInscricao,
}: PrototipoPreviewProps) {
  const bg = bgImageUrl || DEFAULT_BG
  const t = (id: string, fallback: string) => textos[id] ?? fallback
  const minhasInscricoesLabel = detalhesInscricao?.minhasInscricoesLabel || "Minhas inscrições"
  const detalhesTitulo = detalhesInscricao?.titulo || "Detalhes da inscrição"
  const detalhesCampos = detalhesInscricao?.campos?.length ? detalhesInscricao.campos : DEFAULT_DETALHES_CAMPOS
  const [loginOpen, setLoginOpen] = useState(false)
  const [popupPassoId, setPopupPassoId] = useState<string | null>(null)
  // Dialogs that render .p-*-scoped content (PopupCampoDialog, DownloadSuccessDialog, DocumentoPreviewDialog)
  // must portal inside this ref instead of document.body — otherwise their content falls outside the
  // ".mapeador-proto" subtree that prototipoCss's descendant selectors are scoped to.
  const formRootRef = useRef<HTMLDivElement>(null)
  const [downloadInfo, setDownloadInfo] = useState<{ campo: MapeadorCampo; nomeArquivo: string; mensagem: string } | null>(null)
  const [downloadSuccessOpen, setDownloadSuccessOpen] = useState(false)
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)

  function findPasso(passoId: string): MapeadorPasso | undefined {
    for (const p of projetos) {
      for (const e of p.etapas) {
        const found = e.camposPorEtapa.find((ps) => ps.id === passoId)
        if (found) return found
      }
    }
    return undefined
  }

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
    const textoEstiloCss: React.CSSProperties = { textAlign: campo.alinhamento ?? "left", color: campo.cor || undefined }

    let content: React.ReactNode
    switch (campo.tipo) {
      case "titulo_pagina":
        content = (
          <div className="p-title-inline" style={textoEstiloCss}>
            {campo.label}
          </div>
        )
        break
      case "label_destaque":
        content = (
          <div className="p-label-inline" style={textoEstiloCss}>
            {campo.label}
          </div>
        )
        break
      case "texto_informativo":
        content = (
          <p className="p-info" style={textoEstiloCss}>
            {campo.label}
          </p>
        )
        break
      case "divisor":
        content = <hr className="p-hr" />
        break
      case "agrupamento":
        content = (
          <div className="p-grid">
            {(campo.colunas ?? []).map((coluna) => (
              <div key={coluna.id} className="p-coluna" style={larguraStyle(normalizeLargura(coluna.largura))}>
                {coluna.campos.filter(isCampoVisible).map(renderCampo)}
              </div>
            ))}
          </div>
        )
        break
      case "botao":
        return (
          <button
            key={campo.id}
            className={cn("p-btn", isVoltarButton(campo.label) ? "ghost" : "solid")}
            onClick={() => {
              if (campo.acaoBotao === "popup" && campo.popupPassoId) return setPopupPassoId(campo.popupPassoId)
              if (campo.acaoBotao === "download") {
                setDownloadInfo({ campo, nomeArquivo: campo.downloadNomeArquivo || "Documento.pdf", mensagem: campo.downloadMensagem || "Arquivo gerado com sucesso!" })
                setDownloadSuccessOpen(true)
                return
              }
              onBotaoClick(campo)
            }}
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
      case "documento_upload": {
        const nomeArquivo = (values[campo.id] as string) || ""
        content = (
          <label className="p-upload">
            <span className="p-upload-icon">
              <FileText className="h-4 w-4" />
            </span>
            <span className="p-upload-txt">
              <span className="nm">
                {campo.label.toUpperCase()} {campo.obrigatorio && <span className="p-req">*</span>}
              </span>
              {nomeArquivo && <div className="text-xs text-muted-foreground">{nomeArquivo}</div>}
            </span>
            <span className="p-upload-btn">
              <Upload className="h-3.5 w-3.5" /> Anexar
            </span>
            <input type="file" className="sr-only" onChange={(e) => setValue(campo.id, e.target.files?.[0]?.name ?? "")} />
          </label>
        )
        break
      }
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
              {(campo.opcoesLista?.length ? campo.opcoesLista : ["Boleto", "Pix", "Cartão de crédito"]).map((o) => (
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

    // titulo_pagina/label_destaque/texto_informativo already align their own text via textoEstiloCss above;
    // divisor/condicional/agrupamento have no single block worth centering. Everything else (ordinary
    // fields, pagamento_valor, pagamento_formas, botao, documento_upload) centers/right-aligns as a whole
    // block within its grid column when alinhamento is set, without disturbing the default (left) layout.
    const aplicaAlinhamentoBloco =
      (campo.alinhamento === "center" || campo.alinhamento === "right") &&
      !["divisor", "condicional", "agrupamento", "titulo_pagina", "label_destaque", "texto_informativo"].includes(campo.tipo)
    const wrapperStyle: React.CSSProperties = aplicaAlinhamentoBloco
      ? { ...larguraCss, display: "flex", justifyContent: campo.alinhamento === "center" ? "center" : "flex-end" }
      : larguraCss

    return (
      <Fragment key={campo.id}>
        {campo.novaLinha && <div aria-hidden className="h-0 basis-full" />}
        <div style={wrapperStyle} className={campo.novaLinha ? "mt-4" : undefined} data-error={hasError || undefined}>
          {wrapped}
        </div>
      </Fragment>
    )
  }

  if (screen.kind === "landing") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="p-topbar">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8" /> : <span className="p-brand">EXEMPLO</span>}
          <button className="p-profile">
            Pedro <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-portal overflow-y-auto" style={{ backgroundImage: `url(${bg})` }}>
          <div className="w-[32%] min-w-[280px] max-w-md shrink-0 space-y-4">
            <div className="p-card">
              <div className="p-card-title">{minhasInscricoesLabel}</div>
              <div className="flex items-center justify-between">
                <div className="p-card-value">{projeto?.nome}</div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-card">
              <div className="mb-3 flex items-center justify-between">
                <div className="p-card-value">{detalhesTitulo}</div>
                <button className="p-btn ghost !shadow-none !bg-white border !px-2.5 !py-1.5 !text-xs">
                  <Pencil className="mr-1 inline h-3 w-3" /> Editar
                </button>
              </div>
              {detalhesCampos.map((c) => (
                <div className="p-detail-row" key={c.id}>
                  <div className="p-detail-lbl">{c.alias || c.nome}</div>
                  <div className="p-detail-val">{c.valorExemplo || "—"}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-card min-w-[280px] flex-1 !p-0 overflow-hidden">
            <div className="bg-[var(--brand)] p-4 text-center text-sm font-semibold text-white">
              <EditableText id="portal.titulo" value={t("portal.titulo", "Acompanhe aqui o status da sua inscrição")} editing={editingTextos} onChange={onTextoChange} />
            </div>
            <div className="space-y-0 p-5">
              {etapasConcluidas.map((e, index) => {
                const fb = pickFeedback(e)
                const tipo = fb?.tipo ?? "positivo"
                const isPositivo = tipo === "positivo"
                const icone = isPositivo ? "✓" : tipo === "negativo" ? "✕" : "!"
                const isLastRow = index === etapasConcluidas.length - 1 && !nextEtapa
                return (
                  <div
                    className={cn(
                      "p-status-row",
                      isPositivo && "!border-t-0 !-mx-5 !my-0 !rounded-none !px-5 !py-4",
                      isPositivo && index === 0 && "!-mt-5",
                      isPositivo && isLastRow && "!-mb-5"
                    )}
                    style={isPositivo ? { background: "var(--brand)" } : undefined}
                    key={e.id}
                  >
                    <span className={cn("p-status-ic", isPositivo && "!border-white !bg-transparent !text-white")}>{icone}</span>
                    <div>
                      <div className={cn("p-card-value", isPositivo && "!text-white")}>{e.nome}</div>
                      <StatusRowTooltip etapa={e} currentFeedback={fb?.feedback}>
                        <div className={cn("text-xs italic", isPositivo ? "!text-white/85" : "text-muted-foreground")}>{fb?.feedback || "Concluída"}</div>
                      </StatusRowTooltip>
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
                      <StatusRowTooltip etapa={nextEtapa}>
                        <div className="text-xs italic text-muted-foreground">Aguardando conclusão</div>
                      </StatusRowTooltip>
                    </div>
                  </div>
                  {(feedbackPositivo?.botaoNoPortal ?? true) && (
                    <button className="p-btn ghost !shadow-none !bg-white border border-[var(--brand)]" onClick={onAdvanceFromPortal}>
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
    <div ref={formRootRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
            {etapa.camposPorEtapa.map((p, i) =>
              p.tipo === "popup" ? null : (
                <li key={p.id} className={i > screen.passoIndex ? "todo" : undefined}>
                  <span className={cn("ic", i < screen.passoIndex && "done")}>{i < screen.passoIndex ? "✓" : i + 1}</span>
                  <div>
                    <div className="nm">{p.titulo}</div>
                    <div className="st">{i < screen.passoIndex ? "Concluído" : i === screen.passoIndex ? "Aguardando conclusão" : "Pendente"}</div>
                  </div>
                </li>
              )
            )}
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
                  !passo.ocultarBotaoAvancar && (
                    <button className="p-btn solid ml-auto" onClick={() => onBotaoClick({ id: "__auto__", tipo: "botao", label: t("btn.avancar", "Avançar") })}>
                      {t("btn.avancar", "AVANÇAR")}
                    </button>
                  )
                )}
              </div>
            </>
          ) : (
            <p className="p-info">Nenhum passo mapeado para esta etapa ainda. Vá até a aba Mapeamento para começar.</p>
          )}
        </div>
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <PopupCampoDialog
        passo={popupPassoId ? (findPasso(popupPassoId) ?? null) : null}
        onClose={() => setPopupPassoId(null)}
        renderCampo={renderCampo}
        container={formRootRef}
      />
      {downloadInfo && <DownloadToast nomeArquivo={downloadInfo.nomeArquivo} onClose={() => setDownloadInfo(null)} onOpenPreview={() => setDocPreviewOpen(true)} />}
      <DownloadSuccessDialog
        open={downloadSuccessOpen}
        mensagem={downloadInfo?.mensagem ?? ""}
        onClose={() => setDownloadSuccessOpen(false)}
        onContinuar={() => {
          setDownloadSuccessOpen(false)
          if (downloadInfo) onBotaoClick(downloadInfo.campo)
        }}
        container={formRootRef}
      />
      <DocumentoPreviewDialog
        open={docPreviewOpen}
        nomeArquivo={downloadInfo?.nomeArquivo ?? "Documento.pdf"}
        onClose={() => setDocPreviewOpen(false)}
        container={formRootRef}
      />
    </div>
  )
}
