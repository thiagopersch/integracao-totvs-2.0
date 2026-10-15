"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PERMISSION_SENTENCE } from "@/config/tbc-permission-sentence"

interface PermissionSentenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** How to register, in the client's RM, the Consulta SQL that lists the TBC user's profiles. */
export function PermissionSentenceDialog({ open, onOpenChange }: PermissionSentenceDialogProps) {
  const s = PERMISSION_SENTENCE

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${what} copiado.`)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Como configurar a consulta de perfis</DialogTitle>
          <DialogDescription>
            Cadastre uma vez no RM do cliente (Gestão › Ferramentas de Análise › Consultas SQL) e dê ao perfil do
            usuário do TBC permissão para executá-la.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Código</dt>
            <dd className="flex items-center gap-2 font-mono">
              {s.codSentenca}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copiar código"
                onClick={() => copy(s.codSentenca, "Código")}
              >
                <Copy />
              </Button>
            </dd>
            <dt className="text-muted-foreground">Título</dt>
            <dd>{s.title}</dd>
            <dt className="text-muted-foreground">Coligada</dt>
            <dd>{s.codColigada} (global)</dd>
            <dt className="text-muted-foreground">Aplicação</dt>
            <dd>{s.codSistema} (Serviços Globais)</dd>
            <dt className="text-muted-foreground">Parâmetro</dt>
            <dd className="font-mono">CODUSUARIO</dd>
          </dl>
          <div className="relative">
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs">{s.sql}</pre>
            <Button size="sm" variant="outline" className="absolute right-2 top-2" onClick={() => copy(s.sql, "SQL")}>
              <Copy className="mr-1 h-3 w-3" />
              Copiar SQL
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
