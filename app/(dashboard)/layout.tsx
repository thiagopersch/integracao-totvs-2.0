"use client"

import { logoutAction } from "@/actions/auth/login"
import { DashboardSidebar } from "@/components/shared/dashboard-sidebar"
import { NotificationBell } from "@/components/shared/notification-bell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useSidebarStore } from "@/store/sidebar.store"
import { cn } from "@/utils/cn"
import { LogOut, Menu, Moon, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useState } from "react"
import { toast } from "sonner"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const collapsed = useSidebarStore((state) => state.collapsed)
  const toggle = useSidebarStore((state) => state.toggle)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)
  const { user } = useCurrentUser()

  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileNavOpen(false)
  }

  async function handleLogout() {
    const res = await logoutAction()
    if (res.success) {
      toast.success("Sessão encerrada")
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-sidebar-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <DashboardSidebar />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger className="md:hidden absolute top-4 left-4 z-50 flex items-center justify-center rounded-md p-2 hover:bg-accent cursor-pointer">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <DashboardSidebar />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={toggle}>
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full flex items-center justify-center p-1 hover:bg-accent cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.image ?? undefined} />
                  <AvatarFallback>{(user?.name ?? "??").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col">
                    <span>{user?.name ?? "Carregando..."}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="h-4 w-4 mr-2" /> Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}
