/** Shapes of the Rubeus admin log endpoints (`/api/settings/log-filter`, `log-show`, `log-categories`). */

/** One row of `POST /api/settings/log-filter`. `log_type_id` 1 = erro, anything else = info. */
export interface RubeusLogRow {
  id: number
  description: string | null
  portal_id: number | null
  duration: number | null
  portal_title: string | null
  selective_process_id: number | null
  selective_process_title: string | null
  created_at: string
  categories_title: string | null
  categories_id: string | null
  log_type_id: number | null
  person_name: string | null
}

/** `POST /api/settings/log-show` — `sent`/`result` are raw payloads or signed file URLs (TOTVS Query/Processos/DataServer). */
export interface RubeusLogDetail {
  id: number
  created_at: string
  updated_at: string | null
  user_name: string | null
  observation: string | null
  duration: number | null
  portal_title: string | null
  selective_process_title: string | null
  categories_title: string | null
  categories_id: string | null
  stage_title: string | null
  step_title: string | null
  log_location_title: string | null
  sent: string | null
  result: string | null
  description: string | null
  person_name: string | null
  log_status_id: number | null
}

export interface RubeusLogCategory {
  id: number
  title: string
}

/** Filter choice in the UI → `type_id` sent to log-filter. */
export type LogTypeFilter = "error" | "info" | "all"

export const LOG_TYPE_IDS: Record<LogTypeFilter, number[]> = {
  error: [1],
  info: [0],
  all: [0, 1],
}
