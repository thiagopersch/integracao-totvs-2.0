"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { codeEdit, codeLive, codePreview, divider, fullscreen, type ICommand } from "@uiw/react-md-editor/commands"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import "@uiw/react-md-editor/markdown-editor.css"

// The editor touches `window` on import — client only.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false, loading: () => <Skeleton className="h-full min-h-24 w-full" /> })
const MDPreview = dynamic(() => import("@uiw/react-md-editor").then((m) => m.default.Markdown), { ssr: false })

/** "light" | "dark" for the editor's own palette, following the app theme (not only the OS). */
function useColorMode() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark" ? "dark" : "light"
}

/**
 * The editor's own fullscreen is `position: fixed` inside the editor, so within a Dialog/Sheet
 * (transformed ancestors) it only covers the dialog and the modal traps focus outside it. Our
 * toggle opens a nested full-viewport Dialog instead, which works on pages, dialogs and sheets.
 */
function fullscreenCommand(onToggle: () => void, active: boolean): ICommand {
  const label = active ? "Sair da tela cheia (Ctrl+0)" : "Tela cheia (Ctrl+0)"
  return {
    ...fullscreen,
    keyCommand: "expand",
    name: "expand",
    buttonProps: { "aria-label": label, title: label, "aria-pressed": active },
    execute: () => onToggle(),
  }
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
  placeholder?: string
  id?: string
  autoFocus?: boolean
  invalid?: boolean
  /** "edit" = editor + preview tab in the toolbar; "live" = side-by-side. */
  preview?: "edit" | "live" | "preview"
  /** Accessible title of the fullscreen editor (the field's label). */
  label?: string
  className?: string
}

/** Markdown field with toolbar (bold, lists, links, code…) and a preview tab — same editor as Demandas. */
export function MarkdownEditor({
  value,
  onChange,
  height = 200,
  placeholder,
  id,
  autoFocus,
  invalid,
  preview = "edit",
  label = "Editor de texto",
  className,
}: MarkdownEditorProps) {
  const colorMode = useColorMode()
  const [expanded, setExpanded] = useState(false)
  const change = (v?: string) => onChange(v ?? "")

  return (
    <>
      <div
        data-color-mode={colorMode}
        style={{ height }}
        className={cn(
          "markdown-field overflow-hidden rounded-lg border border-input",
          invalid && "border-destructive ring-3 ring-destructive/20",
          className
        )}
      >
        <MDEditor
          value={value}
          onChange={change}
          height={height - 2 /* wrapper border */}
          preview={preview}
          visibleDragbar={false}
          autoFocus={autoFocus}
          textareaProps={{ id, placeholder }}
          extraCommands={[codeEdit, codeLive, codePreview, divider, fullscreenCommand(() => setExpanded(true), false)]}
        />
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none bg-background p-0 ring-0",
            "max-sm:h-dvh! max-sm:max-h-none! max-sm:w-screen! max-sm:max-w-none!"
          )}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          {expanded && (
            <div data-color-mode={colorMode} className="markdown-field markdown-fullscreen h-full">
              <MDEditor
                value={value}
                onChange={change}
                height="100%"
                preview="live"
                visibleDragbar={false}
                autoFocus
                textareaProps={{ placeholder }}
                extraCommands={[codeEdit, codeLive, codePreview, divider, fullscreenCommand(() => setExpanded(false), true)]}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Read-only markdown rendering in the app's colors (transparent background, inherited text). */
export function MarkdownView({ value, className }: { value: string; className?: string }) {
  const colorMode = useColorMode()
  return (
    <div data-color-mode={colorMode} className={cn("markdown-field text-sm", className)}>
      <MDPreview source={value} style={{ backgroundColor: "transparent", color: "inherit", fontSize: "inherit" }} />
    </div>
  )
}
