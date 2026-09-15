import { Suspense } from "react"
import { listMapeadorProjetos } from "@/actions/mapeador"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MapeadorProjetosList } from "@/components/mapeador/mapeador-projetos-list"

export default function MapeadorPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <MapeadorPageContent />
      </Suspense>
    </div>
  )
}

async function MapeadorPageContent() {
  const projetos = await listMapeadorProjetos()
  return <MapeadorProjetosList initialProjetos={projetos} />
}
