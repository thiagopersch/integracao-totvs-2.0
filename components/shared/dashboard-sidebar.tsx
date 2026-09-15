"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, Radio, Settings } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { NAV_ICONS } from "@/lib/nav-icons"
import { navGroups, type NavGroup } from "@/lib/nav-items"
import { hasPermission } from "@/lib/permissions"
import { usePermissions } from "@/hooks/use-permissions"
import { useSidebarStore } from "@/store/sidebar.store"
import { cn } from "@/utils/cn"

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

function isGroupActive(pathname: string, group: NavGroup) {
  return group.items.some((item) => isItemActive(pathname, item.href))
}

function visibleGroups(permissions: string[]): NavGroup[] {
  return navGroups
    .filter((g) => g.label !== "Conta")
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.resource || hasPermission(permissions, item.resource, item.action ?? "read")),
    }))
    .filter((group) => group.items.length > 0)
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const permissions = usePermissions()
  const sidebarGroups = useMemo(() => visibleGroups(permissions), [permissions])
  const activeGroupLabel = useMemo(
    () => (path: string) => sidebarGroups.find((g) => isGroupActive(path, g))?.label ?? null,
    [sidebarGroups]
  )
  const collapsed = useSidebarStore((state) => state.collapsed)
  const toggle = useSidebarStore((state) => state.toggle)
  const [openGroup, setOpenGroup] = useState<string | null>(() => activeGroupLabel(pathname))
  const [lastPathname, setLastPathname] = useState(pathname)

  // Only one collapse may be open at a time; navigating always re-syncs the
  // open group to whichever one contains the active route.
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpenGroup(activeGroupLabel(pathname))
  }

  function toggleGroup(label: string) {
    setOpenGroup((prev) => (prev === label ? null : label))
  }

  function itemActive(href: string) {
    return isItemActive(pathname, href)
  }

  function groupActive(group: NavGroup) {
    return isGroupActive(pathname, group)
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b", collapsed ? "flex justify-center" : "")}>
        {collapsed ? (
          <Radio className="h-6 w-6 text-primary" />
        ) : (
          <h2 className="text-lg font-bold text-primary">TOTVS RM</h2>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0 px-2 py-2">
        <nav className="space-y-1">
          {sidebarGroups.map((group) => {
            const GroupIcon = NAV_ICONS[group.icon] ?? Settings

            // Single-item groups render as a plain link — no point collapsing one route —
            // unless the group opts into always showing as a collapsible section (forceCollapsible).
            if (group.items.length === 1 && !group.forceCollapsible) {
              const item = group.items[0]
              const ItemIcon = NAV_ICONS[item.icon] ?? Settings
              const active = itemActive(item.href)
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
              const active = groupActive(group)
              return (
                <Popover key={group.label}>
                  <PopoverTrigger
                    className={cn(
                      "flex w-full items-center justify-center rounded-lg px-2 py-2 text-sm transition-colors cursor-pointer",
                      active
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
                      const active = itemActive(item.href)
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

            // Expanded sidebar: collapsible (accordion) section per group — only one open at a time.
            const isOpen = openGroup === group.label
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer",
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
                      const active = itemActive(item.href)
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
          onClick={toggle}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" /> Recolher
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
