"use client"

import { useState } from "react"
import { cn } from "@/utils/cn"
import { CodeEditor } from "@/components/shared/code-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/utils/format"
import { Maximize2, Minimize2 } from "lucide-react"
import type { Backup } from "@/generated/prisma/client"
import { WithTooltip } from "@/components/shared/with-tooltip"

interface ViewBackupSentenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  backup: Backup | null
  onRestore: (backupId: string) => void
}

export function ViewBackupSentenceDialog({ open, onOpenChange, backup, onRestore }: ViewBackupSentenceDialogProps) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setFullscreen(false)
      }}
    >
      <DialogContent
        className={cn(
          "transition-[width,height]",
          fullscreen && "h-[95vh]! max-h-[95vh]! w-[95vw]! max-w-[95vw]!"
        )}
        headerActions={
          <WithTooltip label={fullscreen ? "Tamanho normal" : "Expandir"}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? "Tamanho normal" : "Expandir"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </WithTooltip>
        }
      >
        <DialogHeader>
          <DialogTitle>Visualizando sentença</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {backup && (
            <>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cód. Coligada</p>
                  <p>{backup.codColigada || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cód. Sistema</p>
                  <p>{backup.codSystem || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Código da sentença</p>
                  <p>{backup.codeSentence || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nome da sentença</p>
                  <p className="font-medium">{backup.nameSentence || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última alteração no TOTVS</p>
                  <p>{backup.totvsUpdatedAt ? formatDate(backup.totvsUpdatedAt) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário da última alteração no TOTVS</p>
                  <p>{backup.totvsUpdatedBy || "-"}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Conteúdo</p>
                <CodeEditor
                  value={backup.contentSentence ?? ""}
                  language="sql"
                  readOnly
                  theme="dark"
                  resetKey={backup.id}
                  minHeight={fullscreen ? "70vh" : "50vh"}
                />
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => backup && onRestore(backup.id)}
            disabled={!backup}
            className="w-full sm:w-auto"
          >
            Restaurar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
