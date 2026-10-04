"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { CodeEditorProps } from "./code-editor-impl"

export type { CodeEditorLanguage, CodeEditorProps, SqlSchema } from "./code-editor-impl"

/**
 * CodeMirror (7 language packs + sql-formatter) is loaded on demand — it used to ship in the bundle
 * of every page that merely *contains* an editor somewhere (often inside a closed dialog).
 */
export const CodeEditor = dynamic<CodeEditorProps>(() => import("./code-editor-impl").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-[180px] w-full rounded-md" />,
})
