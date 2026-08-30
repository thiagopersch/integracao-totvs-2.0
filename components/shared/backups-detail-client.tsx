"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BackupsSentencesTable } from "@/components/shared/backups-sentences-table"
import { BackupsHistoryTable } from "@/components/shared/backups-history-table"
import { RestoreBackupDialog, type RestoreScope } from "@/components/shared/restore-backup-dialog"
import { RestorePasswordConfirmDialog } from "@/components/shared/restore-password-confirm-dialog"
import type { Backup, BackupRun, Client, Filter, Tbc } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface BackupsDetailClientProps {
  filter: Filter & { client: Client; tbc: Tbc }
  sentences: Backup[]
  sentencesMeta: PaginationMeta
  runs: BackupRun[]
  runsMeta: PaginationMeta
}

export function BackupsDetailClient({ filter, sentences, sentencesMeta, runs, runsMeta }: BackupsDetailClientProps) {
  const router = useRouter()
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; scope: RestoreScope | null }>({
    open: false,
    scope: null,
  })
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean
    scope: RestoreScope | null
    targetTbcId: string | null
  }>({ open: false, scope: null, targetTbcId: null })

  function openRestore(scope: RestoreScope) {
    setRestoreDialog({ open: true, scope })
  }

  function handleProceedToPassword(targetTbcId: string) {
    setPasswordDialog({ open: true, scope: restoreDialog.scope, targetTbcId })
    setRestoreDialog({ open: false, scope: null })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/filters">
          <Button variant="ghost" size="icon" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg">
          {filter.client.name} - {filter.tbc.name} Filtro:{" "}
          <span className="font-jetbrains font-bold">{filter.filter}</span>
        </h1>
      </div>

      <Tabs defaultValue="sentences">
        <TabsList>
          <TabsTrigger value="sentences">Sentenças</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="sentences" className="mt-4">
          <BackupsSentencesTable
            filterId={filter.id}
            data={sentences}
            meta={sentencesMeta}
            onRestoreSingle={(backupId) => openRestore({ type: "single", backupId, filterId: filter.id })}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <BackupsHistoryTable
            filterId={filter.id}
            data={runs}
            meta={runsMeta}
            onRestoreRun={(backupRunId) => openRestore({ type: "run", backupRunId, filterId: filter.id })}
            onRestoreSingle={(backupId) => openRestore({ type: "single", backupId, filterId: filter.id })}
          />
        </TabsContent>
      </Tabs>

      <RestoreBackupDialog
        open={restoreDialog.open}
        onOpenChange={(open) => setRestoreDialog({ open, scope: open ? restoreDialog.scope : null })}
        scope={restoreDialog.scope}
        clientName={filter.client.name}
        tbcName={filter.tbc.name}
        filterValue={filter.filter}
        ownTbcId={filter.tbcId}
        onProceed={handleProceedToPassword}
      />
      <RestorePasswordConfirmDialog
        open={passwordDialog.open}
        onOpenChange={(open) => setPasswordDialog({ open, scope: passwordDialog.scope, targetTbcId: passwordDialog.targetTbcId })}
        scope={passwordDialog.scope}
        targetTbcId={passwordDialog.targetTbcId}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
