"use client"

import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VariableGroup } from "@/lib/message-templates/variable-catalog"
import { VariablePicker } from "./variable-picker"
import { WithTooltip } from "@/components/shared/with-tooltip"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  variableGroups: VariableGroup[]
  className?: string
}

/** Mirrors the email typography inlined by lib/message-templates/render-email.ts, so what's typed
 *  here looks like what's sent (Tailwind's preflight would otherwise flatten headings/lists). */
export const EMAIL_TYPOGRAPHY_CLASSES =
  "text-[15px] leading-relaxed text-neutral-900 [&_h1]:my-2 [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:my-2 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:my-2 [&_h3]:text-[18px] [&_h3]:font-bold [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-[3px] [&_blockquote]:border-neutral-200 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600"

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <WithTooltip label={title}>
      <button
        type="button"
        aria-label={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-accent text-foreground"
        )}
      >
        {children}
      </button>
    </WithTooltip>
  )
}

/** TipTap editor used by text blocks: formatting toolbar + variables inserted at the caret. */
export function RichTextEditor({ value, onChange, variableGroups, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, codeBlock: false, code: false }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: cn("min-h-16 px-3 py-2 focus:outline-none", EMAIL_TYPOGRAPHY_CLASSES) },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            paragraph: e.isActive("paragraph"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            left: e.isActive({ textAlign: "left" }),
            center: e.isActive({ textAlign: "center" }),
            right: e.isActive({ textAlign: "right" }),
            link: e.isActive("link"),
            color: (e.getAttributes("textStyle").color as string | undefined) ?? "#1a1a1a",
          }
        : null,
  })

  if (!editor) return <div className={cn("min-h-24 rounded-md border bg-white", className)} />

  const chain = () => editor.chain().focus()

  function setLink() {
    const previous = (editor!.getAttributes("link").href as string | undefined) ?? ""
    const url = window.prompt("URL do link (https://… ou {{appUrl}}/…):", previous)
    if (url === null) return
    if (!url.trim()) chain().extendMarkRange("link").unsetLink().run()
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-primary/60 bg-white", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-popover p-1">
        <ToolbarButton title="Parágrafo" active={state?.paragraph} onClick={() => chain().setParagraph().run()}>
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Título 1" active={state?.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Título 2" active={state?.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Título 3" active={state?.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Negrito" active={state?.bold} onClick={() => chain().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Itálico" active={state?.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Sublinhado" active={state?.underline} onClick={() => chain().toggleUnderline().run()}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Tachado" active={state?.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <label
          title="Cor do texto"
          className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: state?.color }} />
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={state?.color ?? "#1a1a1a"}
            onChange={(e) => chain().setColor(e.target.value).run()}
          />
        </label>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Lista" active={state?.bullet} onClick={() => chain().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" active={state?.ordered} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Alinhar à esquerda" active={state?.left} onClick={() => chain().setTextAlign("left").run()}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Centralizar" active={state?.center} onClick={() => chain().setTextAlign("center").run()}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Alinhar à direita" active={state?.right} onClick={() => chain().setTextAlign("right").run()}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Link" active={state?.link} onClick={setLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {state?.link && (
          <ToolbarButton title="Remover link" onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
            <Unlink className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        <span className="ml-auto" />
        <VariablePicker groups={variableGroups} onSelect={(key) => chain().insertContent(`{{${key}}}`).run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
