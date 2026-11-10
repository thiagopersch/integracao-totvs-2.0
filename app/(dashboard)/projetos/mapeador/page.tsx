import { Suspense } from "react"
import { listClientesParaMapeador, listMapeadorProjetos, listMapeadorTemplates } from "@/actions/mapeador"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MapeadorProjetosList } from "@/components/mapeador/mapeador-projetos-list"

export default function MapeadorPage() {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<TableSkeleton />}>
        <MapeadorPageContent />
      </Suspense>
    </div>
  )
}

async function MapeadorPageContent() {
  const [projetos, templates, clientes] = await Promise.all([listMapeadorProjetos(), listMapeadorTemplates(), listClientesParaMapeador()])
  return <MapeadorProjetosList initialProjetos={projetos} templates={templates} clientes={clientes} />
}
