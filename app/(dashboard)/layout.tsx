"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Radio, Menu, ChevronLeft, ChevronRight, ChevronDown, LogOut, Moon, Sun, Settings, User } from "lucide-react"
import { useTheme } from "next-themes"
import { Suspense, useState } from "react"
import { logoutAction } from "@/actions/auth/login"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { navGroups, type NavGroup } from "@/lib/nav-items"
import { NAV_ICONS } from "@/lib/nav-icons"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useCurrentUser } from "@/hooks/use-current-user"

const sidebarGroups = navGroups.filter((g) => g.label !== "Conta")

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(sidebarGroups.map((g) => g.label)))
  const { user } = useCurrentUser()

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function isItemActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/")
  }

  function isGroupActive(group: NavGroup) {
    return group.items.some((item) => isItemActive(item.href))
  }

  async function handleLogout() {
    const res = await logoutAction()
    if (res.success) {
      toast.success("Sessão encerrada")
      router.push("/login")
      router.refresh()
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b", collapsed ? "flex justify-center" : "")}>
        {collapsed ? (
          <Radio className="h-6 w-6 text-primary" />
        ) : (
          <h2 className="text-lg font-bold text-primary">TOTVS RM</h2>
        )}
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="space-y-1">
          {sidebarGroups.map((group) => {
            const GroupIcon = NAV_ICONS[group.icon] ?? Settings

            // Single-item groups render as a plain link — no point collapsing one route.
            if (group.items.length === 1) {
              const item = group.items[0]
              const ItemIcon = NAV_ICONS[item.icon] ?? Settings
              const active = isItemActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <ItemIcon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            }

            // Collapsed sidebar: show one icon per group, click opens a popover with its routes.
            if (collapsed) {
              const groupActive = isGroupActive(group)
              return (
                <Popover key={group.label}>
                  <PopoverTrigger
                    className={cn(
                      "flex w-full items-center justify-center rounded-lg px-2 py-2 text-sm transition-colors",
                      groupActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                    )}
                    title={group.label}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-56 p-1">
                    <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</p>
                    {group.items.map((item) => {
                      const ItemIcon = NAV_ICONS[item.icon] ?? Settings
                      const active = isItemActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <ItemIcon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </PopoverContent>
                </Popover>
              )
            }

            // Expanded sidebar: collapsible (accordion) section per group.
            const isOpen = openGroups.has(group.label)
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left font-medium">{group.label}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1 border-l border-border/60 pl-4">
                    {group.items.map((item) => {
                      const ItemIcon = NAV_ICONS[item.icon] ?? Settings
                      const active = isItemActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                          )}
                        >
                          <ItemIcon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>
      <div className={cn("p-3 border-t space-y-2", collapsed && "flex flex-col items-center")}>
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start", collapsed && "justify-center")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4 mr-2" /> Recolher</>}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-sidebar-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      <Sheet>
        <SheetTrigger className="md:hidden absolute top-4 left-4 z-50 flex items-center justify-center rounded-md p-2 hover:bg-accent">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setCollapsed(!collapsed)}>
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
              <DropdownMenuTrigger className="rounded-full flex items-center justify-center p-1 hover:bg-accent">
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
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
