"use client"

import { useRef } from "react"
import { ImagePlus, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageUploadPreviewProps {
  label: string
  preview: string | null
  previewClassName?: string
  accept: string
  dimensionHint: string
  formatHint: string
  onSelect: (file: File) => void
  onRemove: () => void
  changeLabel: string
}

export function ImageUploadPreview({
  label,
  preview,
  previewClassName,
  accept,
  dimensionHint,
  formatHint,
  onSelect,
  onRemove,
  changeLabel,
}: ImageUploadPreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/30",
            previewClassName
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onSelect(file)
              e.target.value = ""
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {preview ? changeLabel : "Anexar imagem"}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRemove}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-2" /> Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dimensionHint}</p>
          <p className="text-xs font-medium">{formatHint}</p>
          <p className="text-xs text-muted-foreground">Imagens com dimensões diferentes serão redimensionadas</p>
        </div>
      </div>
    </div>
  )
}
