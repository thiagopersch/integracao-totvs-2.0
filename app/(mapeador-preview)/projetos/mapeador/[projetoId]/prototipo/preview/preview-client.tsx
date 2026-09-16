"use client"

import { useMemo, useState } from "react"
import { PrototipoPreview } from "@/components/mapeador/prototipo/prototipo-preview"
import { PrototipoNavbar } from "@/components/mapeador/prototipo/prototipo-navbar"
import { buildScreens } from "@/components/mapeador/prototipo/screens"
import { prototipoCss } from "@/components/mapeador/prototipo/styles"
import type { MapeadorCampo, MapeadorProjetoDTO } from "@/types/mapeador"

function isVoltarButton(label: string) {
  return /voltar/i.test(label)
}

export function PreviewClient({ projetos }: { projetos: MapeadorProjetoDTO[] }) {
  const screens = useMemo(() => buildScreens(projetos), [projetos])
  const [screenIndex, setScreenIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const config = projetos[0]?.prototipoConfig ?? {}

  function setValue(campoId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [campoId]: value }))
  }

  function handleBotaoClick(campo: MapeadorCampo) {
    if (isVoltarButton(campo.label)) return setScreenIndex((i) => Math.max(0, i - 1))
    setScreenIndex((i) => Math.min(screens.length - 1, i + 1))
  }

  return (
    <div className="mapeador-proto min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: prototipoCss(".mapeador-proto") }} />
      <div
        className="mapeador-proto"
        style={
          {
            "--brand": config.corMarca || "#0CC1AA",
            "--bar": config.corBarra || "#0AA392",
          } as React.CSSProperties
        }
      >
        <PrototipoPreview
          screen={screens[screenIndex]}
          projetos={projetos}
          values={values}
          errors={new Set()}
          setValue={setValue}
          onBotaoClick={handleBotaoClick}
          onAdvanceFromPortal={() => setScreenIndex((i) => Math.min(screens.length - 1, i + 1))}
          logoUrl={config.logoUrl}
          bgImageUrl={config.bgImageUrl}
          textos={config.textos ?? {}}
          onTextoChange={() => {}}
          editingTextos={false}
          adjustMode={false}
          onLarguraChange={() => {}}
        />
        <PrototipoNavbar screens={screens} screenIndex={screenIndex} projetos={projetos} onJump={setScreenIndex} />
      </div>
    </div>
  )
}
