import { Suspense } from "react"
import { redirect } from "next/navigation"
import { authService } from "@/services/auth.service"
import { getRequestContext } from "@/lib/tenant"
import { ProfileForm } from "@/components/shared/profile-form"
import { notificationService } from "@/services/notification.service"
import { PageHeader } from "@/components/shared/page-header"
import { FormSkeleton } from "@/components/shared/skeletons"

export default function ProfilePage() {
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Perfil" description="Gerencie seus dados e sua senha" />
      <Suspense fallback={<FormSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  )
}

async function ProfileContent() {
  const { userId } = await getRequestContext();
  const [user, settings] = await Promise.all([authService.getUserById(userId), notificationService.getSettings(userId)]);
  if (!user) redirect("/login");

  const emailNotifications = settings.some((s) => s.channel === "EMAIL" && s.enabled);
  return <ProfileForm user={user} initialEmailNotifications={emailNotifications} />
}
