import { Suspense } from "react"
import { listSoapTemplates } from "@/actions/soap"
import { Skeleton } from "@/components/ui/skeleton"
import { SoapTemplatesClient } from "./soap-templates-client"

export default function SoapTemplatesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full m-6" />}>
      <SoapTemplatesContent />
    </Suspense>
  )
}

async function SoapTemplatesContent() {
  const templates = await listSoapTemplates()
  return <SoapTemplatesClient templates={templates} />
}
