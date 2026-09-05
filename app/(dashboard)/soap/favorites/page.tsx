import { Suspense } from "react"
import { listSoapFavorites } from "@/actions/soap"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { SoapFavoritesClient } from "./soap-favorites-client"

export default function SoapFavoritesPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <SoapFavoritesContent />
    </Suspense>
  )
}

async function SoapFavoritesContent() {
  const favorites = await listSoapFavorites()
  return <SoapFavoritesClient favorites={favorites} />
}
