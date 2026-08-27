"use client"

import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SchemaTable } from "@/utils/soap-schema"

interface SoapSchemaViewProps {
  tables: SchemaTable[]
  /** Primary-key metadata only exists for a dataserver's XSD — a process's GetSchema is a sample
   *  instance with no such concept, so the star column is hidden entirely for it. */
  showPrimaryKey: boolean
}

export function SoapSchemaView({ tables, showPrimaryKey }: SoapSchemaViewProps) {
  if (!tables.length) {
    return (
      <p className="text-muted-foreground text-sm p-4">
        Não foi possível interpretar o schema automaticamente — veja a aba XML para o retorno bruto.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {tables.length === 1 ? "Tabela encontrada:" : `Tabelas encontradas (${tables.length}):`}
        </span>
        {tables.map((table) => (
          <a key={table.name} href={`#schema-table-${table.name}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              {table.name}
            </Badge>
          </a>
        ))}
      </div>

      {tables.map((table) => (
        <div key={table.name} id={`schema-table-${table.name}`} className="scroll-mt-4 space-y-2">
          <h3 className="font-heading text-sm font-semibold">{table.name}</h3>
          <div className="overflow-x-auto rounded-lg border border-input">
            <Table>
              <TableHeader>
                <TableRow>
                  {showPrimaryKey && <TableHead className="w-8" />}
                  <TableHead>Nome do Campo</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Default</TableHead>
                  <TableHead>Tamanho Máximo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.fields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showPrimaryKey ? 6 : 5} className="text-center text-sm text-muted-foreground">
                      Sem campos
                    </TableCell>
                  </TableRow>
                ) : (
                  table.fields.map((field, index) => (
                    // TOTVS schemas sometimes redeclare the same field name within one table
                    // (seen live) — index keeps the key unique without hiding the duplicate row.
                    <TableRow key={`${field.name}-${index}`}>
                      {showPrimaryKey && (
                        <TableCell className="w-8">
                          {field.isPrimaryKey && (
                            <Tooltip>
                              <TooltipTrigger render={<Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />} />
                              <TooltipContent>Este campo é chave primária</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{field.name}</TableCell>
                      <TableCell>{field.caption || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{field.type || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{field.defaultValue || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{field.maxLength || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}
