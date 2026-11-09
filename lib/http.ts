/**
 * Minimal JSON POST for client components (replaces axios in the browser bundle). Same shape the
 * callers used: resolves `{ data }`, rejects with an HttpError carrying `response.data` on non-2xx.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly response?: { status: number; data: { error?: string } & Record<string, unknown> }
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers narrow `data` themselves, as they did with axios
export async function postJson<T = any>(url: string, body: unknown, options: { timeout?: number; signal?: AbortSignal } = {}): Promise<{ data: T; status: number }> {
  const signals = [options.signal, options.timeout ? AbortSignal.timeout(options.timeout) : undefined].filter((s): s is AbortSignal => !!s)
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signals.length ? AbortSignal.any(signals) : undefined,
    })
  } catch (error) {
    if ((error as Error).name === "TimeoutError") throw new HttpError(`Tempo limite excedido (${options.timeout} ms)`)
    throw new HttpError((error as Error).message || "Falha de conexão")
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new HttpError(`Request failed with status code ${response.status}`, { status: response.status, data })
  }
  return { data: data as T, status: response.status }
}
