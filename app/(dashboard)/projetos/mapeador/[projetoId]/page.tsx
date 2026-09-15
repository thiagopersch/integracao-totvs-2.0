import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getMapeadorProjeto } from "@/actions/mapeador"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MapeadorClient } from "./mapeador-client"

export default function MapeadorProjetoPage({ params }: { params: Promise<{ projetoId: string }> }) {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <MapeadorProjetoContent params={params} />
    </Suspense>
  )
}

async function MapeadorProjetoContent({ params }: { params: Promise<{ projetoId: string }> }) {
  const { projetoId } = await params
  const projeto = await getMapeadorProjeto(projetoId)
  if (!projeto) notFound()

  return <MapeadorClient initialProjeto={projeto} />
}
