"use client"

import { ClipboardList, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ChecklistFieldCard } from "@/components/tbc-checklist/checklist-field-card"
import { groupChecklistFields, OTHERS_GROUP_NAME } from "@/lib/tbc-checklist-groups"
import type { AddedDataserver } from "@/components/tbc-checklist/tbc-checklist-client"
import type { ProcessoSeletivo } from "@/components/tbc-checklist/processo-seletivo-sidebar"
import type { ChecklistRecord, ChecklistTableResult } from "@/actions/integrations/tbc-checklist"

interface ChecklistContentProps {
  selectedProcesso: ProcessoSeletivo | null
  addedDataservers: AddedDataserver[]
  loadingPrimary: boolean
  onRemoveDataserver: (code: string) => void
  onOpenAddDialog: () => void
}

function TablesView({ dataserverCode, tables }: { dataserverCode: string; tables: ChecklistTableResult[] }) {
  if (tables.length === 1) {
    return <RecordsView dataserverCode={dataserverCode} table={tables[0]} />
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
          <RecordsView dataserverCode={dataserverCode} table={table} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** A table with a single matched row shows its fields directly; more than one (e.g. N áreas
 *  ofertadas sharing the same coligada+IDPS filtro) becomes a collapsed-by-default accordion, one
 *  item per row, so each record's own checklist can be inspected without cluttering the screen. */
function RecordsView({ dataserverCode, table }: { dataserverCode: string; table: ChecklistTableResult }) {
  if (table.records.length === 0) {
    return <p className="pt-3 text-sm text-muted-foreground">Nenhum registro encontrado nesta tabela.</p>
  }
  if (table.records.length === 1) {
    return <FieldsGrid dataserverCode={dataserverCode} record={table.records[0]} />
  }
  return (
    <Accordion defaultValue={[]} className="pt-3">
      {table.records.map((record) => (
        <AccordionItem key={record.key} value={record.key}>
          <AccordionTrigger>{record.label}</AccordionTrigger>
          <AccordionContent>
            <FieldsGrid dataserverCode={dataserverCode} record={record} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function CardsGrid({ fields }: { fields: ChecklistRecord["fields"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {fields.map((field) => (
        <ChecklistFieldCard key={`${field.table}-${field.name}`} field={field} />
      ))}
    </div>
  )
}

/** Groups the record's fields by TOTVS screen tab (`groupChecklistFields`) when a mapping exists
 *  for this Data Server, rendering one open-by-default accordion section per tab ("Outros campos"
 *  stays collapsed). Falls back to the plain flat grid for Data Servers with no mapping yet. */
function FieldsGrid({ dataserverCode, record }: { dataserverCode: string; record: ChecklistRecord }) {
  const groups = groupChecklistFields(dataserverCode, record.fields)
  if (!groups) {
    return <CardsGrid fields={record.fields} />
  }

  const defaultOpen = groups.filter((g) => g.name !== OTHERS_GROUP_NAME).map((g) => g.name)

  return (
    <Accordion defaultValue={defaultOpen}>
      {groups.map((group) => (
        <AccordionItem key={group.name} value={group.name}>
          <AccordionTrigger>{group.name}</AccordionTrigger>
          <AccordionContent>
            <CardsGrid fields={group.fields} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function ChecklistContent({
  selectedProcesso,
  addedDataservers,
  loadingPrimary,
  onRemoveDataserver,
  onOpenAddDialog,
}: ChecklistContentProps) {
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

      {addedDataservers.length === 0 && loadingPrimary && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando checklist...
        </p>
      )}

      {addedDataservers.length === 0 && !loadingPrimary && (
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
          <TablesView dataserverCode={addedDataservers[0].code} tables={addedDataservers[0].tables} />
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
                <TablesView dataserverCode={ds.code} tables={ds.tables} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
