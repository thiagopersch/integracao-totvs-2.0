"use client"

import { ClipboardList, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChecklistFieldCard } from "@/components/tbc-checklist/checklist-field-card"
import type { AddedDataserver } from "@/components/tbc-checklist/tbc-checklist-client"
import type { ProcessoSeletivo } from "@/components/tbc-checklist/processo-seletivo-sidebar"
import type { ChecklistTableResult } from "@/actions/integrations/tbc-checklist"

interface ChecklistContentProps {
  selectedProcesso: ProcessoSeletivo | null
  addedDataservers: AddedDataserver[]
  onRemoveDataserver: (code: string) => void
  onOpenAddDialog: () => void
}

function TablesView({ tables }: { tables: ChecklistTableResult[] }) {
  if (tables.length === 1) {
    return <FieldsGrid table={tables[0]} />
  }
  return (
    <Tabs defaultValue={tables[0]?.table}>
      <TabsList>
        {tables.map((table) => (
          <TabsTrigger key={table.table} value={table.table}>
            {table.table}
          </TabsTrigger>
        ))}
      </TabsList>
      {tables.map((table) => (
        <TabsContent key={table.table} value={table.table}>
          <FieldsGrid table={table} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function FieldsGrid({ table }: { table: ChecklistTableResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3 lg:grid-cols-4">
      {table.fields.map((field) => (
        <ChecklistFieldCard key={`${table.table}-${field.name}`} field={field} />
      ))}
    </div>
  )
}

export function ChecklistContent({ selectedProcesso, addedDataservers, onRemoveDataserver, onOpenAddDialog }: ChecklistContentProps) {
  if (!selectedProcesso) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border text-center text-muted-foreground">
        <ClipboardList className="h-10 w-10" />
        <p className="max-w-xs text-sm">
          Selecione um processo seletivo ao lado para ver o checklist de campos configurados no TOTVS.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Processo: {selectedProcesso.label}</h2>
        <Button type="button" size="sm" onClick={onOpenAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Data Server
        </Button>
      </div>

      {addedDataservers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum Data Server adicionado ainda. Clique em &quot;Adicionar Data Server&quot; para começar o checklist.
        </p>
      )}

      {addedDataservers.length === 1 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{addedDataservers[0].name}</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveDataserver(addedDataservers[0].code)} title="Remover">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <TablesView tables={addedDataservers[0].tables} />
        </div>
      )}

      {addedDataservers.length > 1 && (
        <Tabs defaultValue={addedDataservers[0].code}>
          <TabsList>
            {addedDataservers.map((ds) => (
              <TabsTrigger key={ds.code} value={ds.code}>
                {ds.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {addedDataservers.map((ds) => (
            <TabsContent key={ds.code} value={ds.code}>
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveDataserver(ds.code)} title="Remover">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <TablesView tables={ds.tables} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
