"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import AppBar from "@mui/material/AppBar"
import Box from "@mui/material/Box"
import Drawer from "@mui/material/Drawer"
import IconButton from "@mui/material/IconButton"
import Toolbar from "@mui/material/Toolbar"
import Tooltip from "@mui/material/Tooltip"
import { LogOut, Menu as MenuIcon, Moon, Sun, User } from "lucide-react"
import { logoutAction } from "@/actions/auth/login"
import { AiAssistantBubble } from "@/components/ai-assistant/ai-assistant-bubble"
import { DashboardSidebar } from "@/components/shared/dashboard-sidebar"
import { NotificationBell } from "@/components/shared/notification-bell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { NavGroup } from "@/lib/nav-items"
import { toast } from "@/lib/toast"

export const SIDEBAR_COOKIE = "sidebar-collapsed"
const WIDTH = 256
const MINI_WIDTH = 64

type ShellUser = { name: string; email: string; image: string | null }

export function DashboardShell({
  children,
  groups,
  initialCollapsed,
  aiEnabled,
  user,
}: {
  children: React.ReactNode
  groups: NavGroup[]
  initialCollapsed: boolean
  aiEnabled: boolean
  user: ShellUser
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useAppTheme()
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)

  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    // Read by the server layout, so a reload keeps the sidebar as the user left it.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
  }

  async function handleLogout() {
    const res = await logoutAction()
    if (res.success) {
      toast.success("Sessão encerrada")
      router.push("/login")
      router.refresh()
    }
  }

  const width = collapsed ? MINI_WIDTH : WIDTH

  return (
    // h-dvh (not h-screen): on mobile browsers 100vh includes the collapsible address bar.
    <Box sx={{ display: "flex", height: "100dvh", overflow: "hidden", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width,
          flexShrink: 0,
          transition: (theme) => theme.transitions.create("width"),
          "& .MuiDrawer-paper": { width, overflowX: "hidden", position: "relative", transition: (theme) => theme.transitions.create("width"), borderRight: 0, boxShadow: 1, zIndex: 2 },
        }}
      >
        <DashboardSidebar groups={groups} collapsed={collapsed} onToggle={toggleCollapsed} />
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: false }}
        sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: WIDTH, maxWidth: "85vw" } }}
      >
        <DashboardSidebar groups={groups} collapsed={false} onToggle={() => setMobileOpen(false)} />
      </Drawer>

      <Box sx={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", overflow: "hidden" }}>
        <AppBar position="static" color="inherit" elevation={1} sx={{ zIndex: 1 }}>
          <Toolbar sx={{ gap: 0.5, minHeight: { xs: 56, md: 64 }, px: { xs: 1, md: 2 } }}>
            <IconButton aria-label="Abrir menu" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>
              <MenuIcon className="size-5" />
            </IconButton>
            <IconButton aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={toggleCollapsed} sx={{ display: { xs: "none", md: "inline-flex" } }}>
              <MenuIcon className="size-5" />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}>
              <IconButton aria-label="Alternar tema" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </IconButton>
            </Tooltip>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Conta" className="ml-1 flex cursor-pointer items-center justify-center rounded-full p-1 hover:bg-foreground/5">
                <Avatar className="size-8">
                  <AvatarImage src={user.image} />
                  <AvatarFallback>{(user.name || "??").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{user.name}</span>
                  <span className="text-xs font-normal">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User /> Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, overflow: "auto" }}>
          {children}
        </Box>
      </Box>
      <AiAssistantBubble enabled={aiEnabled} />
    </Box>
  )
}
