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
import type { Backup } from "@/generated/prisma/client"

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
      >
        <DialogHeader>
          <DialogTitle>Visualizando sentença</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {backup && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Nome da sentença</p>
                <p className="text-sm font-medium">{backup.nameSentence || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Coligada</p>
                  <p>{backup.codColigada || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sistema</p>
                  <p>{backup.codSystem || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Código da sentença</p>
                  <p>{backup.codeSentence || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última alteração (TOTVS)</p>
                  <p>{backup.totvsUpdatedAt ? formatDate(backup.totvsUpdatedAt) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário da última alteração</p>
                  <p>{backup.totvsUpdatedBy || "-"}</p>
                </div>
              </div>
              <CodeEditor
                value={backup.contentSentence ?? ""}
                language="sql"
                readOnly
                theme="dark"
                resetKey={backup.id}
                fullscreen={fullscreen}
                onFullscreenChange={setFullscreen}
                minHeight={fullscreen ? "70vh" : "50vh"}
              />
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
