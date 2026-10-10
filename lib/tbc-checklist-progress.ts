/** Where one Data Server is in its load: queued behind the first one, running GetSchema +
 *  ReadView ("view"), fetching its records in batches ("records"), or finished. */
export type DataserverLoadPhase = "waiting" | "view" | "records" | "done" | "failed"

export type DataserverLoadProgress = {
  code: string
  name: string
  phase: DataserverLoadPhase
  /** Records fetched so far / to fetch (known once the view returned). */
  done: number
  total: number
}

/** Share of a Data Server's load the view step stands for — the records take the rest. */
const VIEW_WEIGHT = 0.2

function fraction(item: DataserverLoadProgress): number {
  switch (item.phase) {
    case "waiting":
    case "view":
      return 0
    case "records":
      return VIEW_WEIGHT + (1 - VIEW_WEIGHT) * (item.total ? item.done / item.total : 1)
    default:
      return 1
  }
}

/**
 * 0–100 over every Data Server, each weighing the same. Only ever grows: a Data Server's record
 * count is unknown until its view returns, so counting raw steps would make the bar jump back.
 */
export function progressPercent(items: DataserverLoadProgress[]): number {
  if (!items.length) return 100
  return Math.round((items.reduce((sum, item) => sum + fraction(item), 0) / items.length) * 100)
}

export function isFinished(item: DataserverLoadProgress): boolean {
  return item.phase === "done" || item.phase === "failed"
}

/** What one Data Server is doing right now, for the progress bar and its loading tab. */
export function describeStep(item: DataserverLoadProgress): string {
  switch (item.phase) {
    case "waiting":
      return "Aguardando o primeiro Data Server…"
    case "view":
      return "Consultando o TOTVS…"
    case "records":
      return `Carregando registros ${item.done} de ${item.total}…`
    case "done":
      return "Concluído"
    default:
      return "Falhou"
  }
}
