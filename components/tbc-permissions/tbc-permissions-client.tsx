"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { ProfilesTab } from "@/components/tbc-permissions/profiles-tab"
import { DataserversTab } from "@/components/tbc-permissions/dataservers-tab"
import type { PermissionModel } from "@/config/tbc-permission-models/types"
import type { TbcRow } from "@/services/tbc.service"

interface TbcPermissionsClientProps {
  tbc: TbcRow
  models: PermissionModel[]
}

export function TbcPermissionsClient({ tbc, models }: TbcPermissionsClientProps) {
  const [modelKey, setModelKey] = useState(models[0].key)
  const model = models.find((m) => m.key === modelKey) ?? models[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/tbcs">
            <WithTooltip label="Voltar">
              <Button variant="ghost" size="icon" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </WithTooltip>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Validar permissões</h1>
            <p className="text-sm text-muted-foreground">
              {tbc.name} — usuário <strong>{tbc.user}</strong>. Nenhuma chamada grava dados no RM.
            </p>
          </div>
        </div>
        <Select
          items={models.map((m) => ({ value: m.key, label: m.label }))}
          value={modelKey}
          onValueChange={(v) => v && setModelKey(v)}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                Modelo: {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Keyed by model so each model starts from a clean comparison/probe state. */}
      <Tabs key={model.key} defaultValue="perfis">
        <TabsList>
          <TabsTrigger value="perfis">Perfis e menus</TabsTrigger>
          <TabsTrigger value="dataservers">Data Servers ({model.dataservers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="perfis" className="pt-3" keepMounted>
          <ProfilesTab tbc={tbc} model={model} />
        </TabsContent>
        <TabsContent value="dataservers" className="pt-3" keepMounted>
          <DataserversTab tbc={tbc} model={model} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
