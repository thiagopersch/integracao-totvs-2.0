/**
 * Best-effort parse of a JSON document that is still being written (a streamed tool call):
 * closes any open string/array/object and drops a dangling key or separator, so the UI can show
 * what the model has produced so far. Returns undefined when nothing usable exists yet.
 */
export function parsePartialJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through to repair
  }

  const stack: string[] = []
  let inString = false
  let escaped = false
  for (const char of trimmed) {
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === "{") stack.push("}")
    else if (char === "[") stack.push("]")
    else if (char === "}" || char === "]") stack.pop()
  }

  let repaired = trimmed
  if (inString) repaired += escaped ? '\\"' : '"'
  // Repeatedly drop an incomplete tail ("key":, trailing comma, partial literal) and close.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = repaired.replace(/[,:\s]+$/, "").replace(/,\s*"[^"]*"\s*$/, "") + [...stack].reverse().join("")
    try {
      return JSON.parse(candidate)
    } catch {
      const cut = Math.max(repaired.lastIndexOf(","), repaired.lastIndexOf(":"))
      if (cut <= 0) return undefined
      repaired = repaired.slice(0, cut)
    }
  }
  return undefined
}
