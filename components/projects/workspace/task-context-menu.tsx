"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Clock, Flag, FolderOpen, Layers, Plus, Trash2, User, Workflow } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { deleteProjectTask, moveProjectTask, patchProjectTask } from "@/actions/project-tasks"
import {
  PRIORITIES,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STAGE_CATEGORY_LABELS,
  type PhaseRef,
  type Priority,
  type StageRef,
} from "@/lib/projects"
import type { TeamMember, WorkspaceActions } from "@/components/projects/workspace/types"

/** What the menu needs from a task row/card (kanban cards and list rows both fit). */
export type TaskMenuTarget = {
  id: string
  title: string
  priority: Priority
  assigneeId: string | null
  stageId: string | null
  phaseId: string | null
}

type Options = {
  projectId: string
  /** Every stage of the project (not only the visible kanban columns). */
  stages: StageRef[]
  phases: PhaseRef[]
  team: TeamMember[]
  can: { create: boolean; update: boolean; delete: boolean; logTime: boolean }
  actions: WorkspaceActions
}

const NONE = "__none__"

function Dot({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

/**
 * Right-click menu of a task (priority, assignee, stage/status, phase, open, subtask, hours, delete).
 * `wrap` puts it on a card, `content` feeds a table row's menu; render `dialog` once in the view.
 */
export function useTaskContextMenu({ projectId, stages, phases, team, can, actions }: Options) {
  const [toDelete, setToDelete] = useState<TaskMenuTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function run(action: () => Promise<{ success: boolean; error?: string; warning?: string }>, done: string) {
    const result = await action()
    if (!result.success) return void toast.error(result.error || "Não foi possível alterar a tarefa")
    if (result.warning) toast.warning(result.warning)
    else toast.success(done)
    actions.refresh()
  }

  const patch = (task: TaskMenuTarget, data: Parameters<typeof patchProjectTask>[2], done: string) =>
    run(() => patchProjectTask(projectId, task.id, data), done)

  function content(task: TaskMenuTarget) {
    const stage = stages.find((s) => s.id === task.stageId)
    const assignee = team.find((m) => m.id === task.assigneeId)
    const phase = phases.find((p) => p.id === task.phaseId)
    const current = (text?: string) =>
      text ? <span className="ml-3 max-w-28 truncate text-xs text-muted-foreground">{text}</span> : null

    return (
      <ContextMenuContent className="w-56" onClick={(e) => e.stopPropagation()}>
        <p className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">{task.title}</p>
        <ContextMenuItem onClick={() => actions.openTask(task.id)}>
          <FolderOpen /> Abrir
        </ContextMenuItem>

        {can.update && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Flag /> Prioridade {current(PRIORITY_LABELS[task.priority])}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuRadioGroup
                  value={task.priority}
                  onValueChange={(value) =>
                    patch(task, { priority: value as Priority }, `Prioridade: ${PRIORITY_LABELS[value as Priority]}`)
                  }
                >
                  {[...PRIORITIES].reverse().map((p) => (
                    <ContextMenuRadioItem closeOnClick key={p} value={p}>
                      <Dot color={PRIORITY_COLORS[p]} /> {PRIORITY_LABELS[p]}
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <User /> Responsável {current(assignee?.name ?? "Ninguém")}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-80">
                <ContextMenuRadioGroup
                  value={task.assigneeId ?? NONE}
                  onValueChange={(value) => {
                    const id = value === NONE ? null : (value as string)
                    const name = team.find((m) => m.id === id)?.name
                    patch(task, { assigneeId: id }, name ? `Responsável: ${name}` : "Responsável removido")
                  }}
                >
                  <ContextMenuRadioItem closeOnClick value={NONE}>Sem responsável</ContextMenuRadioItem>
                  {team.map((m) => (
                    <ContextMenuRadioItem closeOnClick key={m.id} value={m.id}>
                      <span className="truncate">{m.name}</span>
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>

            {/* The task status mirrors its stage's category, so changing the stage changes the status. */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Workflow /> Etapa / status {current(stage?.name)}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-80">
                <ContextMenuRadioGroup
                  value={task.stageId ?? ""}
                  onValueChange={(value) => {
                    const next = stages.find((s) => s.id === value)
                    run(
                      () => moveProjectTask(projectId, task.id, { stageId: value as string }),
                      `Movida para ${next?.name ?? "a etapa"}`
                    )
                  }}
                >
                  {stages.map((s) => (
                    <ContextMenuRadioItem closeOnClick key={s.id} value={s.id} className="items-start">
                      <span className="mt-1">
                        <Dot color={s.color} />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{s.name}</span>
                        {/* Status behind a custom stage (hidden when the name already says it). */}
                        {STAGE_CATEGORY_LABELS[s.category] !== s.name && (
                          <span className="text-[11px] text-muted-foreground">{STAGE_CATEGORY_LABELS[s.category]}</span>
                        )}
                      </span>
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>

            {phases.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Layers /> Fase {current(phase?.name ?? "Nenhuma")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-80">
                  <ContextMenuRadioGroup
                    value={task.phaseId ?? NONE}
                    onValueChange={(value) => {
                      const id = value === NONE ? null : (value as string)
                      const name = phases.find((p) => p.id === id)?.name
                      patch(task, { phaseId: id }, name ? `Fase: ${name}` : "Fase removida")
                    }}
                  >
                    <ContextMenuRadioItem closeOnClick value={NONE}>Sem fase</ContextMenuRadioItem>
                    {phases.map((p) => (
                      <ContextMenuRadioItem closeOnClick key={p.id} value={p.id}>
                        <Dot color={p.color} /> <span className="truncate">{p.name}</span>
                      </ContextMenuRadioItem>
                    ))}
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
          </>
        )}

        {(can.create || can.logTime) && <ContextMenuSeparator />}
        {can.create && (
          <ContextMenuItem onClick={() => actions.newTask({ parentId: task.id })}>
            <Plus /> Nova subtarefa
          </ContextMenuItem>
        )}
        {can.logTime && (
          <ContextMenuItem onClick={() => actions.logTime(task.id)}>
            <Clock /> Apontar horas
          </ContextMenuItem>
        )}

        {can.delete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => setToDelete(task)}>
              <Trash2 /> Excluir tarefa
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    )
  }

  /** Puts the menu on a card (the trigger is a plain block wrapper). */
  function wrap(task: TaskMenuTarget, children: React.ReactNode) {
    return (
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        {content(task)}
      </ContextMenu>
    )
  }

  const dialog = (
    <ConfirmDialog
      open={!!toDelete}
      onOpenChange={(open) => !open && !deleting && setToDelete(null)}
      title="Excluir tarefa"
      description={`Excluir "${toDelete?.title ?? ""}"? Tarefas com subtarefas ou demandas vinculadas não podem ser excluídas.`}
      confirmLabel="Excluir"
      variant="destructive"
      loading={deleting}
      loadingLabel="Excluindo..."
      onConfirm={async () => {
        if (!toDelete) return
        setDeleting(true)
        await run(() => deleteProjectTask(projectId, toDelete.id), "Tarefa excluída")
        setDeleting(false)
        setToDelete(null)
      }}
    />
  )

  return { content, wrap, dialog }
}

export type TaskContextMenu = ReturnType<typeof useTaskContextMenu>
