import { Suspense } from "react"
import { listSoapTemplates } from "@/actions/soap"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { SoapTemplatesClient } from "./soap-templates-client"

export default function SoapTemplatesPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <SoapTemplatesContent />
    </Suspense>
  )
}

async function SoapTemplatesContent() {
  const templates = await listSoapTemplates()
  return <SoapTemplatesClient templates={templates} />
}
