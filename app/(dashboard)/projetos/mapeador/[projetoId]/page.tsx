import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getMapeadorProjeto, listClientesParaMapeador } from "@/actions/mapeador"
import { DetailSkeleton } from "@/components/shared/skeletons"
import { MapeadorClient } from "./mapeador-client"

export default function MapeadorProjetoPage({ params }: { params: Promise<{ projetoId: string }> }) {
  return (
    <Suspense fallback={<DetailSkeleton className="m-6" />}>
      <MapeadorProjetoContent params={params} />
    </Suspense>
  )
}

async function MapeadorProjetoContent({ params }: { params: Promise<{ projetoId: string }> }) {
  const { projetoId } = await params
  const [projeto, clientes] = await Promise.all([getMapeadorProjeto(projetoId), listClientesParaMapeador()])
  if (!projeto) notFound()

  return <MapeadorClient initialProjeto={projeto} clientes={clientes} />
}
