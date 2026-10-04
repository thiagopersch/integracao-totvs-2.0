"use client"

import DOMPurify from "dompurify"
import { useMemo, useState } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { renderBlockTree, wrapPreviewDocument } from "@/lib/message-templates/render-email"
import { applyConditionals, interpolate } from "@/lib/message-templates/interpolate"
import { exampleVariables } from "@/lib/message-templates/variable-catalog"
import { whatsappToHtml } from "@/lib/message-templates/whatsapp"
import type { BlockTree } from "@/lib/message-templates/block-types"
import type { MessageChannel } from "@/lib/message-templates/events"

interface PreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: MessageChannel
  subject: string
  content: BlockTree
  bodyText: string
}

/** Full preview: email in an iframe (desktop 600px / mobile 375px) or WhatsApp bubble — optionally
 *  filled with the catalog's example values, exactly as the send path renders it. */
export function PreviewDialog({ open, onOpenChange, channel, subject, content, bodyText }: PreviewDialogProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [withExamples, setWithExamples] = useState(true)

  const examples = useMemo(() => ({ ...exampleVariables(), appUrl: typeof window !== "undefined" ? window.location.origin : "" }), [])
  const fill = (text: string, escape = true) => (withExamples ? interpolate(text, examples, { escape }) : text)

  const doc = useMemo(() => {
    if (channel !== "EMAIL") return ""
    const html = renderBlockTree(content, { baseUrl: typeof window !== "undefined" ? window.location.origin : "" })
    return wrapPreviewDocument(withExamples ? interpolate(applyConditionals(html, examples), examples) : html)
  }, [channel, content, withExamples, examples])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh]! max-h-[90vh]! w-[min(960px,95vw)]! max-w-[95vw]!">
        <DialogHeader>
          <DialogTitle>Pré-visualização — {channel === "EMAIL" ? "E-mail" : "WhatsApp"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2">
              <Switch id="preview-examples" checked={withExamples} onCheckedChange={setWithExamples} />
              <Label htmlFor="preview-examples" className="text-sm">
                Preencher variáveis com dados de exemplo
              </Label>
            </div>
            {channel === "EMAIL" && (
              <div className="flex rounded-md border p-0.5">
                {(["desktop", "mobile"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs",
                      device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                    {d === "desktop" ? "Desktop" : "Celular"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {channel === "EMAIL" ? (
            <>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Assunto: </span>
                <span className="font-medium">{fill(subject, false) || "(sem assunto)"}</span>
              </div>
              <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-md bg-muted/40 p-4">
                <iframe
                  title="Pré-visualização do e-mail"
                  srcDoc={doc}
                  sandbox="allow-scripts"
                  className="h-full min-h-[480px] rounded-md border bg-white shadow-sm transition-[width]"
                  style={{ width: device === "desktop" ? 680 : 375 }}
                />
              </div>
            </>
          ) : (
            <WhatsAppBubble html={whatsappToHtml(fill(bodyText, false))} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/** WhatsApp-like chat background with an outgoing message bubble. */
export function WhatsAppBubble({ html }: { html: string }) {
  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-md bg-[#efeae2] p-6 dark:bg-[#0b141a]">
      <div className="h-fit max-w-[420px] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[14px] leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        {html ? <div className="break-words" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} /> : <span className="opacity-60">(mensagem vazia)</span>}
        <div className="mt-1 text-right text-[11px] opacity-60">
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ✓✓
        </div>
      </div>
    </div>
  )
}
