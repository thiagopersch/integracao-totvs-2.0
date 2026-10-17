import { DatabaseZap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/** Shown instead of a crash when the connected database is missing this feature's tables. */
export function MigrationPendingNotice({ feature }: { feature: string }) {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <DatabaseZap className="h-4 w-4" /> Banco de dados desatualizado
          </p>
          <p>
            {feature} precisa de tabelas que ainda não existem no banco configurado em <code>DATABASE_URL</code>. Aplique as
            migrations nesse banco e reinicie o servidor:
          </p>
          <pre className="rounded bg-muted p-3 text-xs">
            npx prisma migrate deploy{"\n"}npm run prisma:generate{"\n"}npm run sync:permissions
          </pre>
          <p className="text-muted-foreground">
            Se o <code>.env</code> tiver <code>DIRECT_URL</code>, o Prisma CLI aplica as migrations nele (e não no{" "}
            <code>DATABASE_URL</code>) — confira se os dois apontam para o mesmo banco.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
