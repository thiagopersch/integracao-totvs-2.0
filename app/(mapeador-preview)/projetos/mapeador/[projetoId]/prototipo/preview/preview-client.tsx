"use client"

import { useMemo, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PrototipoPreview } from "@/components/mapeador/prototipo/prototipo-preview"
import { PrototipoNavbar } from "@/components/mapeador/prototipo/prototipo-navbar"
import { buildScreens } from "@/components/mapeador/prototipo/screens"
import { prototipoCss } from "@/components/mapeador/prototipo/styles"
import type { MapeadorCampo, MapeadorProjetoDTO } from "@/types/mapeador"

function isVoltarButton(label: string) {
  return /voltar/i.test(label)
}

interface PreviewClientProps {
  projetos: MapeadorProjetoDTO[]
  clienteIdentidade?: { clienteNome: string; mudou: boolean } | null
}

export function PreviewClient({ projetos, clienteIdentidade }: PreviewClientProps) {
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
    <div className="mapeador-proto flex h-screen w-full flex-col overflow-y-auto bg-white">
      <style dangerouslySetInnerHTML={{ __html: prototipoCss(".mapeador-proto") }} />
      {clienteIdentidade?.mudou && (
        <Alert variant="warning" className="m-2">
          <TriangleAlert />
          <AlertTitle>Identidade visual do cliente foi alterada</AlertTitle>
          <AlertDescription>
            A identidade visual adicionada no protótipo, buscada do cliente &quot;{clienteIdentidade.clienteNome}&quot;, foi alterada no cadastro do cliente. Caso queira
            utilizar a nova identidade visual, será necessário adicionar um novo tema ao protótipo.
          </AlertDescription>
        </Alert>
      )}
      <div
        className="mapeador-proto flex min-h-0 flex-1 flex-col"
        data-visualizacao={config.visualizacao ?? "desktop"}
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
          onNovaLinhaChange={() => {}}
        />
        <PrototipoNavbar screens={screens} screenIndex={screenIndex} projetos={projetos} onJump={setScreenIndex} />
      </div>
    </div>
  )
}
