import { Suspense } from "react"
import { redirect } from "next/navigation"
import { authService } from "@/services/auth.service"
import { getRequestContext } from "@/lib/tenant"
import { ProfileForm } from "@/components/shared/profile-form"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProfilePage() {
  return (
    <div className="p-6">
      <PageHeader title="Perfil" description="Gerencie seus dados e sua senha" />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ProfileContent />
      </Suspense>
    </div>
  )
}

async function ProfileContent() {
  const { userId } = await getRequestContext();
  const user = await authService.getUserById(userId);
  if (!user) redirect("/login");

  return <ProfileForm user={user} />
}
