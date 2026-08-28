"use client"

import { useState } from "react"
import DOMPurify from "dompurify"
import { Eye, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const TRUNCATE_LENGTH = 100

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value)
}

/** No @tailwindcss/typography plugin in this project, so raw HTML rendered under Tailwind's
 *  preflight reset would come out flat (no heading sizes, no list bullets, no spacing) — these
 *  arbitrary-variant rules restore just enough baseline styling for it to read as formatted HTML. */
const HTML_CONTENT_CLASSES =
  "text-sm [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_em]:italic [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-input [&_td]:p-1 [&_th]:border [&_th]:border-input [&_th]:p-1 [&_img]:max-w-full"

interface TableCellValueProps {
  value: string
}

/**
 * Any table-cell value over 100 characters is replaced entirely by an eye button (no truncated
 * preview) that opens the full value in a dialog — sanitized+rendered as HTML when it looks like
 * markup, plain (whitespace-preserving) text otherwise. Shared by every SOAP table view
 * (GetSchema/ReadView/ReadRecord) so a long field value never blows out a table row.
 */
export function TableCellValue({ value }: TableCellValueProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (!value) return <>-</>
  if (value.length <= TRUNCATE_LENGTH) return <>{value}</>

  const isHtml = looksLikeHtml(value)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <DialogTrigger
          render={
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-xs">
                  <Eye />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Ver valor completo</TooltipContent>
      </Tooltip>
      <DialogContent
        className={
          expanded ? "h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw]" : "h-[70vh] max-h-[70vh] w-[70vw] max-w-[70vw]"
        }
      >
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>Valor completo</DialogTitle>
          <Button variant="outline" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {expanded ? "Reduzir" : "Expandir"}
          </Button>
        </DialogHeader>
        <DialogBody className="overflow-auto">
          {isHtml ? (
            <div className={HTML_CONTENT_CLASSES} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }} />
          ) : (
            <pre className="font-mono text-sm whitespace-pre-wrap break-words">{value}</pre>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
