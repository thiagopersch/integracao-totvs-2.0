import { redirect } from "next/navigation"

export default function SoapHistoryPage() {
  redirect("/admin/activity?source=SOAP")
}
