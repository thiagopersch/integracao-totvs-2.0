import { Suspense } from "react"
import { listSoapFavorites } from "@/actions/soap"
import { Skeleton } from "@/components/ui/skeleton"
import { SoapFavoritesClient } from "./soap-favorites-client"

export default function SoapFavoritesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full m-6" />}>
      <SoapFavoritesContent />
    </Suspense>
  )
}

async function SoapFavoritesContent() {
  const favorites = await listSoapFavorites()
  return <SoapFavoritesClient favorites={favorites} />
}
