import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS } from "@/lib/ps-compare/labels"
import type { CompareStatus } from "@/lib/ps-compare/types"
import { CheckCircle2, CircleDot, MinusCircle, PlusCircle } from "lucide-react"

const VARIANT = { igual: "success", diferente: "destructive", so_a: "outline", so_b: "default" } as const
const ICON = { igual: CheckCircle2, diferente: CircleDot, so_a: MinusCircle, so_b: PlusCircle } as const

export function StatusBadge({ status }: { status: CompareStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
}

const ICON_COLOR: Record<CompareStatus, string> = {
  igual: "text-emerald-600 dark:text-emerald-400",
  diferente: "text-destructive",
  so_a: "text-amber-600 dark:text-amber-400",
  so_b: "text-sky-600 dark:text-sky-400",
}

export function StatusIcon({ status, className }: { status: CompareStatus; className?: string }) {
  const Icon = ICON[status]
  return <Icon aria-label={STATUS_LABELS[status]} className={`size-4 shrink-0 ${ICON_COLOR[status]} ${className ?? ""}`} />
}
