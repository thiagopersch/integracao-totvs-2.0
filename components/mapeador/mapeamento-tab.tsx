"use client"

import { CollapsibleSection } from "@/components/mapeador/collapsible-section"
import { EtapasFichaSection } from "@/components/mapeador/etapas-ficha-section"
import { CamposPorEtapaBuilder } from "@/components/mapeador/campos-por-etapa-builder"

export function MapeamentoTab() {
  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="Etapas da ficha"
        description="A ordem aqui define a ordem das colunas no visualizador e do stepper no protótipo. Arraste pelo ícone para reordenar."
        defaultOpen={false}
      >
        <EtapasFichaSection />
      </CollapsibleSection>

      <CollapsibleSection
        title="Campos por etapa"
        description="Selecione a etapa e monte os passos com os campos, botões, pop-ups e textos informativos da tela."
        defaultOpen={false}
      >
        <CamposPorEtapaBuilder />
      </CollapsibleSection>
    </div>
  )
}
