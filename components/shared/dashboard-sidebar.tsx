"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Box from "@mui/material/Box"
import Collapse from "@mui/material/Collapse"
import Divider from "@mui/material/Divider"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import ListSubheader from "@mui/material/ListSubheader"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Tooltip from "@mui/material/Tooltip"
import { ChevronDown, ChevronLeft, ChevronRight, Radio, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NAV_ICONS } from "@/lib/nav-icons"
import { findNavItemByPathname, type NavGroup } from "@/lib/nav-items"

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

function isGroupActive(pathname: string, group: NavGroup) {
  return group.items.some((item) => isItemActive(pathname, item.href))
}

const itemSx = {
  borderRadius: 2,
  py: 0.75,
  px: 1.5,
  color: "text.secondary",
  "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "primary.main", color: "primary.contrastText" },
  "&.Mui-selected .MuiListItemIcon-root": { color: "primary.contrastText" },
} as const

const iconSx = { minWidth: 0, mr: 1.5, color: "inherit", "& svg": { width: 16, height: 16 } } as const

/**
 * Sidebar navigation. `groups` arrive already filtered by permission from the server layout,
 * so the menu is complete on the first paint (no wait for the client session).
 */
export function DashboardSidebar({
  groups,
  collapsed,
  onToggle,
}: {
  groups: NavGroup[]
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const activeGroupLabel = useMemo(
    () => (path: string) => groups.find((g) => isGroupActive(path, g))?.label ?? null,
    [groups]
  )
  const [openGroup, setOpenGroup] = useState<string | null>(() => activeGroupLabel(pathname))
  const [lastPathname, setLastPathname] = useState(pathname)
  const [flyout, setFlyout] = useState<{ label: string; anchor: HTMLElement } | null>(null)

  // Only one group is open at a time; navigating re-syncs it to the group of the active route.
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpenGroup(activeGroupLabel(pathname))
    setFlyout(null)
  }

  // Only the most specific match is active — /projetos/gestao/campos highlights "Propriedades",
  // not also its parent route "Gestão de Projetos".
  const activeHref = findNavItemByPathname(pathname)?.href
  const itemActive = (href: string) => (activeHref ? activeHref === href : isItemActive(pathname, href))

  function renderLink(href: string, label: string, icon: string, nested = false) {
    const Icon = NAV_ICONS[icon] ?? Settings
    const link = (
      <ListItemButton
        key={href}
        component={Link}
        href={href}
        selected={itemActive(href)}
        sx={{ ...itemSx, justifyContent: collapsed && !nested ? "center" : "flex-start", px: collapsed && !nested ? 1 : 1.5 }}
      >
        <ListItemIcon sx={{ ...iconSx, mr: collapsed && !nested ? 0 : 1.5 }}>
          <Icon />
        </ListItemIcon>
        {(!collapsed || nested) && <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />}
      </ListItemButton>
    )
    return collapsed && !nested ? (
      <Tooltip key={href} title={label} placement="right">
        {link}
      </Tooltip>
    ) : (
      link
    )
  }

  function renderGroup(group: NavGroup) {
    // Single-item groups render as a plain link unless the group opts into a collapsible section.
    if (group.items.length === 1 && !group.forceCollapsible) {
      const item = group.items[0]
      return renderLink(item.href, item.label, item.icon)
    }

    const GroupIcon = NAV_ICONS[group.icon] ?? Settings
    const active = isGroupActive(pathname, group)

    // Collapsed sidebar: one icon per group; click opens a flyout menu with its routes.
    if (collapsed) {
      return (
        <Tooltip key={group.label} title={group.label} placement="right">
          <ListItemButton
            selected={active}
            onClick={(event) => setFlyout({ label: group.label, anchor: event.currentTarget })}
            sx={{ ...itemSx, justifyContent: "center", px: 1 }}
            aria-haspopup="menu"
          >
            <ListItemIcon sx={{ ...iconSx, mr: 0 }}>
              <GroupIcon />
            </ListItemIcon>
          </ListItemButton>
        </Tooltip>
      )
    }

    const isOpen = openGroup === group.label
    return (
      <Fragment key={group.label}>
        <ListItemButton onClick={() => setOpenGroup((prev) => (prev === group.label ? null : group.label))} sx={itemSx} aria-expanded={isOpen}>
          <ListItemIcon sx={iconSx}>
            <GroupIcon />
          </ListItemIcon>
          <ListItemText primary={group.label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
          <ChevronDown className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </ListItemButton>
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <List disablePadding sx={{ ml: 2, pl: 1, borderLeft: 1, borderColor: "divider", display: "grid", gap: 0.5, mt: 0.5 }}>
            {group.items.map((item) => renderLink(item.href, item.label, item.icon, true))}
          </List>
        </Collapse>
      </Fragment>
    )
  }

  const flyoutGroup = flyout ? groups.find((g) => g.label === flyout.label) : undefined

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: collapsed ? "center" : "flex-start", minHeight: 61, alignItems: "center" }}>
        {collapsed ? (
          <Radio className="size-6 text-primary" />
        ) : (
          <h2 className="font-(family-name:--font-orbitron) text-lg font-bold tracking-wider text-primary">PerschTech</h2>
        )}
      </Box>
      <Box component="nav" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, py: 1 }}>
        <List disablePadding sx={{ display: "grid", gap: 0.5 }}>
          {groups.map((group, index) => {
            const startsSection = group.section && group.section !== groups[index - 1]?.section
            return (
              <Fragment key={group.label}>
                {startsSection &&
                  (collapsed ? (
                    <Divider sx={{ my: 1, mx: 1 }} />
                  ) : (
                    <ListSubheader disableSticky sx={{ bgcolor: "transparent", lineHeight: "28px", pt: 1.5, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {group.section}
                    </ListSubheader>
                  ))}
                {renderGroup(group)}
              </Fragment>
            )
          })}
        </List>
      </Box>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Button variant="ghost" size="sm" className={collapsed ? "w-full justify-center" : "w-full justify-start"} onClick={onToggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronRight /> : (<><ChevronLeft /> Recolher</>)}
        </Button>
      </Box>
      <Menu
        open={Boolean(flyoutGroup)}
        anchorEl={flyout?.anchor}
        onClose={() => setFlyout(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ list: { dense: true, subheader: <ListSubheader sx={{ lineHeight: "32px", fontSize: 12 }}>{flyoutGroup?.label}</ListSubheader> } }}
      >
        {flyoutGroup?.items.map((item) => {
          const Icon = NAV_ICONS[item.icon] ?? Settings
          return (
            <MenuItem key={item.href} component={Link} href={item.href} selected={itemActive(item.href)} sx={{ gap: 1.5, minWidth: 200 }}>
              <Icon className="size-4" />
              {item.label}
            </MenuItem>
          )
        })}
      </Menu>
    </Box>
  )
}
