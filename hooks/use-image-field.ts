import { useEffect, useMemo, useState } from "react"

export function useImageField(existingUrl: string | null | undefined) {
  const [file, setFile] = useState<File | null>(null)
  const [removed, setRemoved] = useState(false)

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const preview = file ? objectUrl : removed ? null : existingUrl || null

  function select(nextFile: File) {
    setFile(nextFile)
    setRemoved(false)
  }

  function remove() {
    setFile(null)
    setRemoved(true)
  }

  function reset() {
    setFile(null)
    setRemoved(false)
  }

  function toFormValue(existing: string | undefined): File | string {
    if (file) return file
    return removed ? "" : existing || ""
  }

  return { file, preview, removed, select, remove, reset, toFormValue }
}
