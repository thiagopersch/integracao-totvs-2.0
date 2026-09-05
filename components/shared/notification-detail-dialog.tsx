"use client"

import { useState } from "react"
import Link from "next/link"
import { Maximize2, Minimize2 } from "lucide-react"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/utils/format"
import { getNotificationCategory } from "@/lib/notification-category"
import { ENTITY_LABELS } from "@/lib/entity-labels"
import { ACTION_LABELS } from "@/lib/audit-labels"
import { ERROR_KIND_LABELS, ERROR_KIND_BADGE_VARIANT, type ErrorKind } from "@/lib/error-kind"
import { cn } from "@/lib/utils"
import type { Notification } from "@/generated/prisma/client"

type ChangeEntry = { field: string; from?: unknown; to?: unknown }

type NotificationData = {
  entity?: string
  action?: string
  changes?: ChangeEntry[]
  href?: string
  integration?: string
  // Failure context — populated by soap.call.failed / backup.run.failed / integrations.test.failed
  // (see lib/notification-types.ts) so the dialog can show exactly what broke and where.
  source?: "soap" | "filter" | "api"
  sourceLabel?: string
  errorKind?: ErrorKind
  errorMessage?: string
  clientId?: string
  clientName?: string
  tbcName?: string
  method?: string
  wsName?: string
  url?: string
  logId?: string
  entityType?: "dataserver" | "process"
  entityName?: string
} | null

interface NotificationDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notification: Notification | null
}

function formatValue(value: unknown): string {
  if (value === undefined) return "—"
  if (value === null) return "vazio"
  if (typeof value === "boolean") return value ? "sim" : "não"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function NotificationDetailDialog({ open, onOpenChange, notification }: NotificationDetailDialogProps) {
  const [expanded, setExpanded] = useState(false)

  if (!notification) return null

  const category = getNotificationCategory(notification.type)
  const data = (notification.data as NotificationData) ?? null
  const entityLabel = data?.entity ? (ENTITY_LABELS[data.entity] ?? data.entity) : null
  const actionLabel = data?.action ? (ACTION_LABELS[data.action] ?? data.action) : null
  const errorKindLabel = data?.errorKind ? ERROR_KIND_LABELS[data.errorKind] : null

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setExpanded(false) }}>
      <DialogContent
        className={cn(
          expanded ? "h-[90vh]! max-h-[90vh]! w-[90vw]! max-w-[90vw]!" : "h-[70vh]! max-h-[70vh]! w-[70vw]! max-w-[70vw]!"
        )}
        headerActions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Tamanho normal" : "Expandir"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        }
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <category.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {notification.title}
            <Badge variant="outline">{category.label}</Badge>
            {!notification.readAt && <Badge>Não lida</Badge>}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p>{formatDate(notification.createdAt)}</p>
            </div>
            {entityLabel && (
              <div>
                <p className="text-xs text-muted-foreground">Módulo</p>
                <p>{entityLabel}</p>
              </div>
            )}
            {actionLabel && (
              <div>
                <p className="text-xs text-muted-foreground">Ação</p>
                <p className="capitalize">{actionLabel}</p>
              </div>
            )}
            {data?.clientName && (
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p>{data.clientName}</p>
              </div>
            )}
            {data?.sourceLabel && (
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <p>{data.sourceLabel}</p>
              </div>
            )}
            {data?.tbcName && (
              <div>
                <p className="text-xs text-muted-foreground">TBC</p>
                <p>{data.tbcName}</p>
              </div>
            )}
            {data?.method && (
              <div>
                <p className="text-xs text-muted-foreground">Método SOAP</p>
                <p>{data.method}{data.wsName ? ` (${data.wsName})` : ""}</p>
              </div>
            )}
            {data?.entityName && (
              <div>
                <p className="text-xs text-muted-foreground">
                  {data.entityType === "process" ? "Processo executado" : "Dataserver executado"}
                </p>
                <p className="font-mono">{data.entityName}</p>
              </div>
            )}
            {data?.url && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">URL</p>
                <p className="break-all">{data.url}</p>
              </div>
            )}
            {data?.integration && (
              <div>
                <p className="text-xs text-muted-foreground">Integração</p>
                <p>{data.integration}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p>{notification.readAt ? `Lida em ${formatDate(notification.readAt)}` : "Não lida"}</p>
            </div>
          </div>

          {errorKindLabel ? (
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Tipo de erro</p>
                <Badge variant={ERROR_KIND_BADGE_VARIANT[data!.errorKind!]}>{errorKindLabel}</Badge>
              </div>
              <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-2 text-xs text-red-600 dark:text-red-400">
                {data?.errorMessage || notification.body}
              </pre>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Mensagem</p>
              <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-2 text-xs">{notification.body}</pre>
            </div>
          )}

          {data?.changes && data.changes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">O que mudou</p>
              <div className="divide-y rounded-md border text-xs">
                {data.changes.map((change) => (
                  <div key={change.field} className="grid grid-cols-3 gap-2 p-2">
                    <span className="font-medium">{change.field}</span>
                    {"to" in change && !("from" in change) ? (
                      <span className="col-span-2 break-all">{formatValue(change.to)}</span>
                    ) : "from" in change && !("to" in change) ? (
                      <span className="col-span-2 break-all text-muted-foreground line-through">{formatValue(change.from)}</span>
                    ) : (
                      <span className="col-span-2 break-all">
                        <span className="text-muted-foreground line-through">{formatValue(change.from)}</span>
                        {" → "}
                        <span>{formatValue(change.to)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.href && (
            <Link
              href={data.href}
              onClick={() => onOpenChange(false)}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Ver registro
            </Link>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
