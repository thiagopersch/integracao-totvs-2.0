"use client"

import type { MapeadorProjetoDTO } from "@/types/mapeador"
import { screenLabel, type PrototipoScreen } from "@/components/mapeador/prototipo/screens"

interface PrototipoNavbarProps {
  screens: PrototipoScreen[]
  screenIndex: number
  projetos: MapeadorProjetoDTO[]
  onJump: (index: number) => void
}

export function PrototipoNavbar({ screens, screenIndex, projetos, onJump }: PrototipoNavbarProps) {
  const groups: { label: string; startIndex: number }[] = []
  screens.forEach((s, i) => {
    if (s.kind === "landing") return
    const label = projetos[s.projetoIndex]?.nome ?? ""
    if (!groups.length || groups[groups.length - 1].label !== label) {
      groups.push({ label, startIndex: i })
    }
  })

  return (
    <div className="p-navbar">
      <button disabled={screenIndex === 0} onClick={() => onJump(screenIndex - 1)}>
        ◀
      </button>
      <select value={screenIndex} onChange={(e) => onJump(Number(e.target.value))}>
        <option value={0}>1. {screenLabel(screens[0], projetos)}</option>
        {groups.map((group) => {
          const endIndex = groups[groups.indexOf(group) + 1]?.startIndex ?? screens.length
          return (
            <optgroup key={group.startIndex} label={group.label}>
              {screens.slice(group.startIndex, endIndex).map((s, i) => {
                const idx = group.startIndex + i
                return (
                  <option key={idx} value={idx}>
                    {idx + 1}. {screenLabel(s, projetos)}
                  </option>
                )
              })}
            </optgroup>
          )
        })}
      </select>
      <button disabled={screenIndex === screens.length - 1} onClick={() => onJump(screenIndex + 1)}>
        ▶
      </button>
      <span className="cnt">
        {screenIndex + 1} / {screens.length}
      </span>
    </div>
  )
}
