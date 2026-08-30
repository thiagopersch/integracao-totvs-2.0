"use client"

import { useEffect, useRef, useState } from "react"
import { EditorView, basicSetup } from "codemirror"
import { EditorState, type Extension } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import { linter } from "@codemirror/lint"
import { json, jsonParseLinter } from "@codemirror/lang-json"
import { xml } from "@codemirror/lang-xml"
import { sql, MSSQL } from "@codemirror/lang-sql"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { javascript } from "@codemirror/lang-javascript"
import { php } from "@codemirror/lang-php"
import { format as formatSql } from "sql-formatter"
import { useTheme } from "next-themes"
import { cn } from "@/utils/cn"
import { formatXml } from "@/utils/xml"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Copy, Wand2, Maximize2, Minimize2 } from "lucide-react"
import { toast } from "sonner"

export type CodeEditorLanguage = "sql" | "html" | "css" | "javascript" | "php" | "json" | "xml"

const FORMATTABLE_LANGUAGES = new Set<CodeEditorLanguage>(["json", "xml", "sql"])

function languageExtension(language: CodeEditorLanguage): Extension {
  switch (language) {
    case "json":
      return [json(), linter(jsonParseLinter())]
    case "xml":
      return xml({ autoCloseTags: true })
    // TOTVS RM sentences run against SQL Server — MSSQL dialect gives the closest keyword set.
    case "sql":
      return sql({ dialect: MSSQL })
    case "html":
      return html()
    case "css":
      return css()
    case "javascript":
      return javascript()
    case "php":
      return php()
  }
}

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language: CodeEditorLanguage
  readOnly?: boolean
  /** Forces the editor to reinitialize its document from `value`, e.g. pass entity.id ?? "new". */
  resetKey?: string | number
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  toolbar?: boolean
  className?: string
  /** Applied to the outer wrapper — pass "flex-1 min-h-0 flex flex-col" to make the editor fill a flex parent instead of using a fixed `minHeight`. */
  containerClassName?: string
  minHeight?: string
  /** "auto" (default) follows the app's light/dark toggle; "dark" always renders One Dark Pro regardless of it. */
  theme?: "auto" | "dark"
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  resetKey,
  fullscreen = false,
  onFullscreenChange,
  toolbar = true,
  className,
  containerClassName,
  minHeight = "180px",
  theme = "auto",
}: CodeEditorProps) {
  const { theme: appTheme } = useTheme()
  const [editorEl, setEditorEl] = useState<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorEl) return
    const isDark = theme === "dark" || appTheme === "dark"

    const extensions: Extension[] = [basicSetup, languageExtension(language), isDark ? oneDark : []]
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
    } else if (onChange) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString())
        })
      )
    }

    const state = EditorState.create({ doc: value, extensions })

    if (viewRef.current) viewRef.current.destroy()
    viewRef.current = new EditorView({ state, parent: editorEl })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorEl, resetKey, language, readOnly, theme, appTheme])

  useEffect(() => {
    requestAnimationFrame(() => viewRef.current?.requestMeasure())
  }, [fullscreen])

  function handleFormat() {
    const view = viewRef.current
    if (!view || !FORMATTABLE_LANGUAGES.has(language)) return
    const current = view.state.doc.toString()
    try {
      const formatted =
        language === "json"
          ? JSON.stringify(JSON.parse(current), null, 2)
          : language === "sql"
            ? formatSql(current, { language: "tsql" })
            : formatXml(current)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } })
      onChange?.(formatted)
    } catch {
      toast.error("Conteúdo inválido, não foi possível formatar")
    }
  }

  function handleCopy() {
    const view = viewRef.current
    if (!view) return
    navigator.clipboard.writeText(view.state.doc.toString())
    toast.success("Conteúdo copiado")
  }

  return (
    <div className={cn("space-y-1", containerClassName)}>
      {toolbar && (
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="uppercase text-[10px]">{language}</Badge>
          <div className="flex items-center gap-1">
            {FORMATTABLE_LANGUAGES.has(language) && !readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={handleFormat} title="Formatar">
                <Wand2 className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={handleCopy} title="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
            {onFullscreenChange && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onFullscreenChange(!fullscreen)}
                title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      )}
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              ref={setEditorEl}
              className={cn(
                "w-full rounded-lg border border-input overflow-hidden text-sm [&_.cm-editor.cm-focused]:outline-none [&_.cm-editor]:h-full [&_.cm-editor]:min-h-(--code-editor-min-h)",
                className
              )}
              style={{ minHeight, "--code-editor-min-h": minHeight } as React.CSSProperties}
            />
          }
        />
        <ContextMenuContent>
          {FORMATTABLE_LANGUAGES.has(language) && !readOnly && (
            <ContextMenuItem onClick={handleFormat}>
              <Wand2 className="h-4 w-4" /> Formatar
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4" /> Copiar
          </ContextMenuItem>
          {onFullscreenChange && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onFullscreenChange(!fullscreen)}>
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
