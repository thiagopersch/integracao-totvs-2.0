import { redirect } from "next/navigation"

export default function DeletionLogsPage() {
  redirect("/admin/activity?source=DELETION")
}
