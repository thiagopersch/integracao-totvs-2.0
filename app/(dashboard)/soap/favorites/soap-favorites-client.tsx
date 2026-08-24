"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/utils/format"
import { deleteSoapFavorite } from "@/actions/soap"

export type FavoriteItem = {
  id: string
  name: string
  dataserver: string | null
  process: string | null
  method: string | null
  createdAt: Date
}

export function SoapFavoritesClient({ favorites }: { favorites: FavoriteItem[] }) {
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(id: string) {
    setRemovingId(id)
    const result = await deleteSoapFavorite(id)
    if (result.success) {
      toast.success("Removido dos favoritos")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao remover favorito")
    }
    setRemovingId(null)
  }

  return (
    <div className="p-6">
      <PageHeader title="Favoritos SOAP" description="Chamadas SOAP favoritas" />
      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhum favorito"
          description="Marque chamadas como favoritas para acesso rápido"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <Card key={fav.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{fav.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  {fav.dataserver && <Badge variant="outline" className="text-xs">{fav.dataserver}</Badge>}
                  {fav.method && <Badge variant="outline" className="text-xs">{fav.method}</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(fav.createdAt)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removingId === fav.id}
                    onClick={() => handleRemove(fav.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
