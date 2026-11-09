// @ts-check
/**
 * `cacheHandlers.remote` ("use cache: remote") backed by Upstash Redis, so cached reads are shared by
 * every serverless instance instead of living in each one's memory. Without Redis env (local dev,
 * Docker) it falls back to Next's in-memory handler, so nothing else needs to change.
 *
 * Storage:
 *   nc:e:<cacheKey>  JSON { value(base64), tags, stale, timestamp, expire, revalidate }, TTL = expire
 *   nc:tags          HASH tag → last invalidation timestamp (ms), shared by all instances
 *
 * Tag coordination follows the Next docs (cacheHandlers.md → "Distributed Tag Coordination"):
 * updateTags() writes the timestamp to Redis and to the local map; refreshTags() (called before
 * requests) re-reads the hash, throttled to once per second per instance; get() discards entries
 * older than any of their tags' (or soft tags') invalidation.
 */
import { Redis } from "@upstash/redis"
import { createDefaultCacheHandler } from "next/dist/server/lib/cache-handlers/default.js"

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
const PREFIX = process.env.CACHE_KEY_PREFIX || "nc"
const TAGS_KEY = `${PREFIX}:tags`
const REFRESH_EVERY_MS = 1000
/** Upstash rejects request bodies above its plan limit (1 MB on the free tier) — skip bigger entries. */
const MAX_ENTRY_BYTES = 900 * 1024

/** @returns {import("next/dist/server/lib/cache-handlers/types").CacheHandler} */
function createRedisCacheHandler() {
  const redis = new Redis({ url: /** @type {string} */ (url), token: /** @type {string} */ (token), automaticDeserialization: false })
  /** @type {Map<string, number>} */
  const tagTimestamps = new Map()
  /** @type {Map<string, Promise<void>>} */
  const pendingSets = new Map()
  let lastRefresh = 0

  /** @param {string[]} tags */
  const latestInvalidation = (tags) => tags.reduce((max, tag) => Math.max(max, tagTimestamps.get(tag) ?? 0), 0)

  /** @param {Uint8Array} bytes */
  const toStream = (bytes) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })

  return {
    async get(cacheKey, softTags) {
      const pending = pendingSets.get(cacheKey)
      if (pending) await pending
      try {
        const raw = /** @type {string | null} */ (await redis.get(`${PREFIX}:e:${cacheKey}`))
        if (!raw) return undefined
        const data = JSON.parse(raw)
        if (Date.now() > data.timestamp + data.revalidate * 1000) return undefined
        if (latestInvalidation([...data.tags, ...softTags]) > data.timestamp) return undefined
        return {
          value: toStream(Buffer.from(data.value, "base64")),
          tags: data.tags,
          stale: data.stale,
          timestamp: data.timestamp,
          expire: data.expire,
          revalidate: data.revalidate,
        }
      } catch (error) {
        console.error("[cache-handler:redis] get failed — treating as a miss:", /** @type {Error} */ (error).message)
        return undefined
      }
    },

    async set(cacheKey, pendingEntry) {
      /** @type {() => void} */
      let done = () => {}
      pendingSets.set(cacheKey, new Promise((resolve) => (done = () => resolve(undefined))))
      try {
        const entry = await pendingEntry
        const chunks = []
        const reader = entry.value.getReader()
        for (;;) {
          const { done: finished, value } = await reader.read()
          if (finished) break
          chunks.push(Buffer.from(value))
        }
        const body = Buffer.concat(chunks)
        if (body.byteLength > MAX_ENTRY_BYTES) return
        const ttl = Math.max(1, Math.min(Math.ceil(entry.expire), 60 * 60 * 24 * 30))
        await redis.set(
          `${PREFIX}:e:${cacheKey}`,
          JSON.stringify({
            value: body.toString("base64"),
            tags: entry.tags,
            stale: entry.stale,
            timestamp: entry.timestamp,
            expire: entry.expire,
            revalidate: entry.revalidate,
          }),
          { ex: ttl }
        )
      } catch (error) {
        console.error("[cache-handler:redis] set failed:", /** @type {Error} */ (error).message)
      } finally {
        done()
        pendingSets.delete(cacheKey)
      }
    },

    async refreshTags() {
      const now = Date.now()
      if (now - lastRefresh < REFRESH_EVERY_MS) return
      lastRefresh = now
      try {
        const all = /** @type {Record<string, string> | null} */ (await redis.hgetall(TAGS_KEY))
        if (!all) return
        for (const [tag, ts] of Object.entries(all)) {
          const value = Number(ts)
          if (value > (tagTimestamps.get(tag) ?? 0)) tagTimestamps.set(tag, value)
        }
      } catch (error) {
        console.error("[cache-handler:redis] refreshTags failed:", /** @type {Error} */ (error).message)
      }
    },

    async getExpiration(tags) {
      return latestInvalidation(tags)
    },

    async updateTags(tags) {
      if (tags.length === 0) return
      const now = Date.now()
      /** @type {Record<string, string>} */
      const fields = {}
      for (const tag of tags) {
        tagTimestamps.set(tag, now)
        fields[tag] = String(now)
      }
      try {
        await redis.hset(TAGS_KEY, fields)
      } catch (error) {
        console.error("[cache-handler:redis] updateTags failed:", /** @type {Error} */ (error).message)
      }
    },
  }
}

const handler = url && token ? createRedisCacheHandler() : createDefaultCacheHandler(50 * 1024 * 1024)

export default handler
