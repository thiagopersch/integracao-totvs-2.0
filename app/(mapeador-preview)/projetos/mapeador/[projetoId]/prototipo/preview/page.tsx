import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getMapeadorProjeto, listMapeadorProjetos } from "@/actions/mapeador"
import { checkClienteIdentidadeTema } from "@/actions/mapeador-tema"
import { PreviewClient } from "./preview-client"

export default function PrototipoPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projetoId: string }>
  searchParams: Promise<{ gerarPara?: string }>
}) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Carregando protótipo…</div>}>
      <PrototipoPreviewContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function PrototipoPreviewContent({
  params,
  searchParams,
}: {
  params: Promise<{ projetoId: string }>
  searchParams: Promise<{ gerarPara?: string }>
}) {
  const { projetoId } = await params
  const { gerarPara } = await searchParams
  const projeto = await getMapeadorProjeto(projetoId)
  if (!projeto) notFound()

  let projetos = [projeto]
  if (gerarPara === "todos") {
    const summaries = await listMapeadorProjetos()
    const all = await Promise.all(summaries.map((s) => getMapeadorProjeto(s.id)))
    projetos = all.filter((p): p is NonNullable<typeof p> => !!p)
  }

  const clienteIdentidade = await checkClienteIdentidadeTema(projeto.prototipoConfig)

  return <PreviewClient projetos={projetos} clienteIdentidade={clienteIdentidade} />
}
