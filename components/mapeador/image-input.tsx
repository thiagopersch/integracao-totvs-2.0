"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { uploadMapeadorImagem } from "@/actions/mapeador-upload"

interface ImageInputProps {
  label: string
  value: string | null | undefined
  onChange: (url: string | null) => void
  hint?: string
  kind?: "logo" | "background"
}

export function ImageInput({ label, value, onChange, hint, kind = "logo" }: ImageInputProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlDraft, setUrlDraft] = useState(value ?? "")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("kind", kind)
      const result = await uploadMapeadorImagem(formData)
      if (!result.success) {
        toast.error(result.error || "Erro ao enviar imagem")
        return
      }
      onChange(result.url)
      setOpen(false)
    } finally {
      setUploading(false)
    }
  }

  function handleUrlSave() {
    onChange(urlDraft.trim() || null)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" type="button" />}>
          {value ? "Trocar" : "Enviar"}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <Tabs defaultValue="upload">
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1">
                Enviar arquivo
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1">
                Colar link
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-2 space-y-2">
              {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ""
                }}
              />
              <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Selecionar arquivo
              </Button>
            </TabsContent>
            <TabsContent value="url" className="mt-2 space-y-2">
              <Input placeholder="https://..." value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} />
              <Button type="button" className="w-full" onClick={handleUrlSave}>
                Salvar link
              </Button>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon-sm" type="button" onClick={() => onChange(null)} title="Remover">
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  )
}
