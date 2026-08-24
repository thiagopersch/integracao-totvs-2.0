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
import type { Backup } from "@prisma/client"

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
            <CodeEditor
              value={backup.contentSentence ?? ""}
              language="sql"
              readOnly
              resetKey={backup.id}
              fullscreen={fullscreen}
              onFullscreenChange={setFullscreen}
              minHeight={fullscreen ? "70vh" : "50vh"}
            />
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
