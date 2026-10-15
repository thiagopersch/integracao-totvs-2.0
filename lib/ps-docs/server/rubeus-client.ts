import https from "node:https";
import axios from "axios";
import { authHeaders } from "@/lib/ps-docs/api-helpers";
import type { PsCredentials } from "@/lib/ps-docs/credential";

/** Server-side HTTP client for the Rubeus portal admin API, shared by every call of one unit of
 *  work (a Server Action, or one whole "Buscar elementos" sweep):
 *  - at most `concurrency` requests in flight — the limit is per request, never per task, so a
 *    task awaiting another task's requests can't deadlock the queue;
 *  - identical requests (method + URL + body) are made once and the response is shared — the
 *    environment-wide catalogs, a pop-up referenced by several etapas, and the `selected-stage`
 *    read by both the field-label harvest and the etapa parse;
 *  - one keep-alive agent, so hundreds of calls to the same host reuse TLS connections;
 *  - an abort signal stops queued requests from starting. */

export interface RubeusResponse {
  status: number;
  data: unknown;
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RubeusClient {
  get(url: string, options?: RequestOptions): Promise<RubeusResponse>;
  post(url: string, body: unknown, options?: RequestOptions): Promise<RubeusResponse>;
  /** Requests actually sent (deduplicated ones not counted) — for the sweep's summary log. */
  readonly requestCount: number;
}

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 32 });

/** FIFO concurrency limiter: `run(fn)` waits for a free slot, runs `fn`, frees the slot. */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const release = () => {
    active--;
    queue.shift()?.();
  };
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export function createRubeusClient(credentials: PsCredentials, options: { concurrency?: number; signal?: AbortSignal } = {}): RubeusClient {
  const run = createLimiter(options.concurrency ?? 10);
  const memo = new Map<string, Promise<RubeusResponse>>();
  const baseHeaders = authHeaders(credentials);
  let requestCount = 0;

  const request = (method: "GET" | "POST", url: string, body: unknown, opts: RequestOptions = {}): Promise<RubeusResponse> => {
    const key = `${method} ${url} ${body === undefined ? "" : JSON.stringify(body)}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const promise = run(async () => {
      if (options.signal?.aborted) throw new DOMException("Busca cancelada", "AbortError");
      requestCount++;
      const res = await axios.request({
        method,
        url,
        data: body,
        headers: { ...baseHeaders, ...opts.headers },
        validateStatus: () => true,
        timeout: opts.timeout ?? 30_000,
        httpsAgent: keepAliveAgent,
        signal: options.signal,
      });
      return { status: res.status, data: res.data };
    });
    memo.set(key, promise);
    return promise;
  };

  return {
    get: (url, opts) => request("GET", url, undefined, opts),
    post: (url, body, opts) => request("POST", url, body ?? null, opts),
    get requestCount() {
      return requestCount;
    },
  };
}

/** Throws the `{ response: { status } }` shape `sessionErrorMessage` understands. */
export function httpError(status: number, what: string): Error {
  return Object.assign(new Error(`HTTP ${status} ao consultar ${what}`), { response: { status } });
}
