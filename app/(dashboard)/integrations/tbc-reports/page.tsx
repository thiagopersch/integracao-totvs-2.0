import { listAllTbcs } from "@/actions/admin/tbcs"
import { TbcReportsClient } from "./tbc-reports-client"

export default async function TbcReportsPage() {
  const tbcs = await listAllTbcs()

  return (
    <TbcReportsClient
      initialTbcs={tbcs.map((t) => ({ id: t.id, name: t.name, link: t.link }))}
    />
  )
}
