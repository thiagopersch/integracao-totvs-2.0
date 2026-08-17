"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Building2,
  Server,
  Filter,
  Database,
  Workflow,
  FolderTree,
  FileText,
  Users,
  Radio,
  History,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Search,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Suspense, useState } from "react"
import { logoutAction } from "@/actions/auth/login"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

const sidebarItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Clientes", icon: Building2, href: "/admin/clients" },
  { label: "TBCs", icon: Server, href: "/admin/tbcs" },
  { label: "Filtros", icon: Filter, href: "/admin/filters" },
  { label: "Dataservers", icon: Database, href: "/admin/dataservers" },
  { label: "Processos", icon: Workflow, href: "/admin/processes" },
  { label: "Categorias", icon: FolderTree, href: "/admin/sentence-categories" },
  { label: "Sentenças", icon: FileText, href: "/admin/sentences" },
  { label: "Usuários", icon: Users, href: "/admin/users" },
  { label: "Integração SOAP", icon: Radio, href: "/soap/builder" },
  { label: "Histórico SOAP", icon: History, href: "/soap/history" },
  { label: "Endpoints SOAP", icon: Settings, href: "/admin/soap-endpoints" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

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
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
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
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full flex items-center justify-center p-1 hover:bg-accent">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Administrador</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="h-4 w-4 mr-2" /> Configurações
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
