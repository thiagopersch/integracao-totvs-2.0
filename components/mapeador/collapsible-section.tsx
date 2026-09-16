"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({ title, description, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none flex-row items-center justify-between space-y-0"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CardHeader>
      <CardContent className={cn(!open && "hidden", "print:block")}>{children}</CardContent>
    </Card>
  )
}
