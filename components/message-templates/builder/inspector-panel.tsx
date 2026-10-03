"use client"

import { useRef, useState } from "react"
import { Loader2, MousePointerClick, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadMessageTemplateImage } from "@/actions/message-templates"
import { findBlock } from "@/lib/message-templates/block-tree-utils"
import { resolveLinkHref, toAppPath, type LinkType } from "@/lib/message-templates/app-link"
import { flattenVariables } from "@/lib/message-templates/variable-catalog"
import {
  BLOCK_TYPE_LABELS,
  type Block,
  type ButtonBlock,
  type ContainerBlock,
  type DividerBlock,
  type ImageBlock,
  type LeafBlock,
  type RowBlock,
  type TableBlock,
} from "@/lib/message-templates/block-types"
import { VariableInput } from "../variable-input"
import { AlignField, ColorField, FieldRow, NumberField, SegmentedField } from "./fields"
import { useBuilder } from "./builder-context"

type Patch<T extends { props: object }> = (props: Partial<T["props"]>) => void

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t pt-3 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  )
}

function VisibleIfField({ value, onChange }: { value?: string; onChange: (value: string | undefined) => void }) {
  const { variableGroups } = useBuilder()
  const fields = flattenVariables(variableGroups)
  const items = [{ value: "__always", label: "Sempre visível" }, ...fields.map((f) => ({ value: f.key, label: f.label }))]
  return (
    <FieldRow label="Exibir somente se">
      <Select items={items} value={value || "__always"} onValueChange={(v) => onChange(!v || v === "__always" ? undefined : v)}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.value === "__always" ? item.label : `${item.label} estiver preenchido`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  )
}

/**
 * Link with a "Link do app | URL própria" switch. App links are stored as a path and get the
 * sending environment's address ({{appUrl}}) when rendered — a full URL pasted here is reduced to
 * its path, so it keeps working in any environment.
 */
function LinkField({
  label,
  href,
  linkType,
  onChange,
  optional,
}: {
  label: string
  href: string
  linkType: LinkType
  onChange: (patch: { href: string; linkType: LinkType }) => void
  optional?: boolean
}) {
  const { variableGroups } = useBuilder()
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const isApp = linkType === "app"
  const finalHref = resolveLinkHref(href, linkType).replace(/\{\{\s*appUrl\s*\}\}/, origin)

  return (
    <div className="space-y-2">
      <SegmentedField
        label={label}
        value={linkType}
        onChange={(next) => onChange({ linkType: next, href: next === "app" ? toAppPath(href) : href })}
        options={[
          { value: "app", label: "Link do app" },
          { value: "url", label: "URL própria" },
        ]}
      />
      <VariableInput
        compact
        value={href}
        onChange={(value) => onChange({ linkType, href: isApp && /^https?:\/\//i.test(value.trim()) ? toAppPath(value) : value })}
        groups={variableGroups}
        placeholder={isApp ? "/contracts" : "https://…"}
      />
      <p className="text-[11px] break-all text-muted-foreground">
        {finalHref ? (
          <>
            Abre: <span className="font-mono text-foreground/80">{finalHref}</span>
            {isApp && " (no envio, usa o endereço configurado do sistema)"}
          </>
        ) : optional ? (
          "Sem link."
        ) : isApp ? (
          "Informe o caminho no sistema, ex.: /contracts. Também pode colar a URL completa da página."
        ) : (
          "Informe a URL completa, ex.: https://site.com.br."
        )}
      </p>
    </div>
  )
}

function ImageInspector({ block, patch }: { block: ImageBlock; patch: Patch<ImageBlock> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const p = block.props

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    const result = await uploadMessageTemplateImage(formData)
    setUploading(false)
    if (result.success) patch({ src: result.url })
    else toast.error(result.error)
  }

  return (
    <>
      <Section title="Imagem">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
          {p.src ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        <FieldRow label="ou URL da imagem">
          <Input value={p.src} onChange={(e) => patch({ src: e.target.value })} placeholder="https://…" className="h-8 text-xs" />
        </FieldRow>
        <FieldRow label="Texto alternativo">
          <Input value={p.alt} onChange={(e) => patch({ alt: e.target.value })} placeholder="Descrição da imagem" className="h-8 text-xs" />
        </FieldRow>
        <LinkField label="Link ao clicar (opcional)" optional href={p.href ?? ""} linkType={p.linkType ?? "url"} onChange={patch} />
      </Section>
      <Section title="Layout">
        <AlignField value={p.align} onChange={(align) => patch({ align })} />
        <SegmentedField
          label="Largura"
          value={p.width ? (p.widthUnit ?? "px") : "auto"}
          onChange={(unit) =>
            unit === "auto"
              ? patch({ width: undefined, widthUnit: undefined })
              : patch({ widthUnit: unit, width: unit === "%" ? 100 : 200 })
          }
          options={[
            { value: "auto", label: "Original" },
            { value: "px", label: "px" },
            { value: "%", label: "%" },
          ]}
        />
        {p.width !== undefined && (
          <NumberField
            label="Tamanho"
            value={p.width}
            onChange={(width) => patch({ width: Math.max(width, 1) })}
            min={1}
            max={p.widthUnit === "%" ? 100 : 600}
            suffix={p.widthUnit === "%" ? "%" : "px"}
          />
        )}
        <NumberField label="Arredondamento" value={p.borderRadius} onChange={(borderRadius) => patch({ borderRadius })} max={50} />
      </Section>
    </>
  )
}

function ButtonInspector({ block, patch }: { block: ButtonBlock; patch: Patch<ButtonBlock> }) {
  const { variableGroups } = useBuilder()
  const p = block.props
  return (
    <>
      <Section title="Conteúdo">
        <FieldRow label="Texto do botão">
          <VariableInput compact value={p.label} onChange={(label) => patch({ label })} groups={variableGroups} />
        </FieldRow>
        <LinkField label="Link" href={p.href} linkType={p.linkType ?? "url"} onChange={patch} />
      </Section>
      <Section title="Estilo">
        <ColorField label="Cor de fundo" value={p.bgColor} onChange={(bgColor) => patch({ bgColor })} />
        <ColorField label="Cor do texto" value={p.textColor} onChange={(textColor) => patch({ textColor })} />
        <AlignField value={p.align} onChange={(align) => patch({ align })} />
        <NumberField label="Arredondamento" value={p.radius} onChange={(radius) => patch({ radius })} max={40} />
        <NumberField label="Espaçamento vertical" value={p.paddingY} onChange={(paddingY) => patch({ paddingY })} max={40} />
        <NumberField label="Espaçamento horizontal" value={p.paddingX} onChange={(paddingX) => patch({ paddingX })} max={80} />
      </Section>
    </>
  )
}

function DividerInspector({ block, patch }: { block: DividerBlock; patch: Patch<DividerBlock> }) {
  const p = block.props
  return (
    <Section title="Estilo">
      <ColorField label="Cor" value={p.color} onChange={(color) => patch({ color })} />
      <NumberField label="Espessura" value={p.thickness} onChange={(thickness) => patch({ thickness })} min={1} max={10} />
      <NumberField label="Margem vertical" value={p.marginY} onChange={(marginY) => patch({ marginY })} max={64} />
    </Section>
  )
}

function TableInspector({ block, patch }: { block: TableBlock; patch: Patch<TableBlock> }) {
  const { variableGroups } = useBuilder()
  const { cells, hasHeader } = block.props
  const cols = cells[0]?.length ?? 1

  const setCell = (r: number, c: number, value: string) =>
    patch({ cells: cells.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row)) })

  return (
    <>
      <Section title="Estrutura">
        <div className="flex items-center justify-between">
          <Label htmlFor="table-header" className="text-xs">
            Primeira linha como cabeçalho
          </Label>
          <Switch id="table-header" checked={hasHeader} onCheckedChange={(v) => patch({ hasHeader: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cells.length >= 50}
            onClick={() => patch({ cells: [...cells, Array(cols).fill("")] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Linha
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cols >= 10}
            onClick={() => patch({ cells: cells.map((row) => [...row, ""]) })}
          >
            <Plus className="mr-1 h-3 w-3" /> Coluna
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cells.length <= 1}
            onClick={() => patch({ cells: cells.slice(0, -1) })}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Últ. linha
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cols <= 1}
            onClick={() => patch({ cells: cells.map((row) => row.slice(0, -1)) })}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Últ. coluna
          </Button>
        </div>
      </Section>
      <Section title="Células">
        {cells.map((row, r) => (
          <div key={r} className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">{hasHeader && r === 0 ? "Cabeçalho" : `Linha ${hasHeader ? r : r + 1}`}</p>
            {row.map((cell, c) => (
              <VariableInput
                key={c}
                compact
                value={cell}
                onChange={(value) => setCell(r, c, value)}
                groups={variableGroups}
                placeholder={`Coluna ${c + 1}`}
              />
            ))}
          </div>
        ))}
      </Section>
      <Section title="Estilo">
        <ColorField label="Fundo do cabeçalho" value={block.props.headerBgColor ?? "#f8fafc"} onChange={(headerBgColor) => patch({ headerBgColor })} />
        <ColorField label="Cor da borda" value={block.props.borderColor ?? "#e2e8f0"} onChange={(borderColor) => patch({ borderColor })} />
      </Section>
    </>
  )
}

function RowInspector({ block, patch }: { block: RowBlock; patch: Patch<RowBlock> }) {
  const { addColumn, resizeColumn } = useBuilder()
  const p = block.props
  return (
    <>
      <Section title="Colunas">
        {block.children.map((column, i) => (
          <NumberField
            key={column.id}
            label={`Largura da coluna ${i + 1}`}
            value={column.props.widthPercent}
            onChange={(w) => resizeColumn(block.id, column.id, w)}
            min={5}
            max={95}
            suffix="%"
          />
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={block.children.length >= 6} onClick={() => addColumn(block.id)}>
          <Plus className="mr-1 h-3 w-3" /> Adicionar coluna
        </Button>
        <p className="text-[11px] text-muted-foreground">Para remover uma coluna, use o botão &quot;−&quot; no topo dela no canvas.</p>
      </Section>
      <Section title="Estilo">
        <ColorField label="Cor de fundo" value={p.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} allowTransparent />
        <NumberField label="Espaçamento vertical" value={p.paddingY} onChange={(paddingY) => patch({ paddingY })} />
        <NumberField label="Espaçamento horizontal" value={p.paddingX} onChange={(paddingX) => patch({ paddingX })} />
        <VisibleIfField value={p.visibleIf} onChange={(visibleIf) => patch({ visibleIf })} />
      </Section>
    </>
  )
}

function ContainerInspector({ block, patch }: { block: ContainerBlock; patch: Patch<ContainerBlock> }) {
  const p = block.props
  const flex = p.display === "flex"
  return (
    <>
      <Section title="Aparência">
        <ColorField label="Cor de fundo" value={p.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} allowTransparent />
        <ColorField label="Cor da borda" value={p.borderColor ?? "transparent"} onChange={(borderColor) => patch({ borderColor })} allowTransparent />
        <NumberField label="Arredondamento" value={p.borderRadius ?? 0} onChange={(borderRadius) => patch({ borderRadius })} max={40} />
        <VisibleIfField value={p.visibleIf} onChange={(visibleIf) => patch({ visibleIf })} />
      </Section>
      <Section title="Espaçamento">
        <NumberField label="Margem vertical" value={p.marginY} onChange={(marginY) => patch({ marginY })} />
        <NumberField label="Margem horizontal" value={p.marginX} onChange={(marginX) => patch({ marginX })} />
        <NumberField label="Preenchimento vertical" value={p.paddingY} onChange={(paddingY) => patch({ paddingY })} />
        <NumberField label="Preenchimento horizontal" value={p.paddingX} onChange={(paddingX) => patch({ paddingX })} />
      </Section>
      <Section title="Disposição dos elementos">
        <SegmentedField
          label="Exibição"
          value={p.display ?? "block"}
          onChange={(display) => patch({ display })}
          options={[
            { value: "block", label: "Empilhados" },
            { value: "flex", label: "Lado a lado (flex)" },
          ]}
        />
        {flex && (
          <>
            <SegmentedField
              label="Direção"
              value={p.flexDirection ?? "row"}
              onChange={(flexDirection) => patch({ flexDirection })}
              options={[
                { value: "row", label: "Linha" },
                { value: "column", label: "Coluna" },
                { value: "row-reverse", label: "Linha ↺" },
                { value: "column-reverse", label: "Col. ↺" },
              ]}
            />
            <SegmentedField
              label="Distribuição"
              value={p.justifyContent ?? "flex-start"}
              onChange={(justifyContent) => patch({ justifyContent })}
              options={[
                { value: "flex-start", label: "Início" },
                { value: "center", label: "Centro" },
                { value: "flex-end", label: "Fim" },
                { value: "space-between", label: "Espaçado" },
              ]}
            />
            <SegmentedField
              label="Alinhamento"
              value={p.alignItems ?? "stretch"}
              onChange={(alignItems) => patch({ alignItems })}
              options={[
                { value: "flex-start", label: "Topo" },
                { value: "center", label: "Meio" },
                { value: "flex-end", label: "Base" },
                { value: "stretch", label: "Esticar" },
              ]}
            />
            <NumberField label="Espaço entre elementos" value={p.gap ?? 0} onChange={(gap) => patch({ gap })} max={48} />
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          No e-mail, o modo lado a lado é convertido em tabela, pois os clientes de e-mail não suportam flexbox.
        </p>
      </Section>
    </>
  )
}

/** Right-hand panel: properties of the selected block, edited live (no modal). */
export function InspectorPanel() {
  const { tree, selectedId, updateBlock, select } = useBuilder()
  const found = selectedId ? findBlock(tree, selectedId) : null

  if (!found) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <MousePointerClick className="h-5 w-5" />
        Selecione um elemento no canvas para editar suas propriedades.
      </div>
    )
  }

  const block = found.block
  const patch = (props: object) =>
    updateBlock(block.id, (b) => ({ ...b, props: { ...b.props, ...props } }) as Block | LeafBlock)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{BLOCK_TYPE_LABELS[block.type]}</p>
        <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => select(null)}>
          Fechar
        </button>
      </div>
      <FieldRow label="Nome do elemento">
        <Input
          value={block.name ?? ""}
          onChange={(e) => updateBlock(block.id, (b) => ({ ...b, name: e.target.value }))}
          className="h-8 text-xs"
          maxLength={60}
        />
      </FieldRow>
      {block.type === "text" && (
        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          Edite o texto diretamente no canvas: use a barra de formatação para títulos, negrito, listas, cores, links e para inserir variáveis.
        </p>
      )}
      {block.type === "image" && <ImageInspector block={block} patch={patch} />}
      {block.type === "button" && <ButtonInspector block={block} patch={patch} />}
      {block.type === "divider" && <DividerInspector block={block} patch={patch} />}
      {block.type === "table" && <TableInspector block={block} patch={patch} />}
      {block.type === "row" && <RowInspector block={block} patch={patch} />}
      {block.type === "container" && <ContainerInspector block={block} patch={patch} />}
    </div>
  )
}
