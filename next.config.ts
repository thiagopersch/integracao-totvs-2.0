import type { NextConfig } from "next";

// Applied to every response (login and other public pages included — the proxy only reached
// authenticated routes). The CSP is deliberately limited to directives that need no nonces, so it
// can't break Next's inline scripts/styles: no framing (clickjacking), no plugins, no <base> or
// form hijacking.
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

/** Versioned/immutable files in public/ (fonts, hashed assets): cached by the browser and CDN for a year. */
const IMMUTABLE = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
/** Other public/ files (logos, icons) can be replaced in place under the same name: a day, then revalidate. */
const PUBLIC_ASSET = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

/**
 * URLs from before the sidebar was regrouped by section (/operations, /registry, /totvs, /rubeus).
 * Kept as redirects because old links live on in stored notifications, saved message-template app
 * links, bookmarks and e-mails. Order matters: more specific sources first.
 */
const LEGACY_ROUTES: Array<[string, string]> = [
  ["/demands", "/operations/demands"],
  ["/contracts", "/operations/contracts"],
  ["/projetos/gestao/campos", "/operations/projects/properties"],
  ["/projetos/gestao", "/operations/projects"],
  ["/projetos/mapeador", "/operations/projects/mapper"],
  ["/admin/clients", "/registry/clients"],
  ["/analysts", "/registry/analysts"],
  ["/requesters", "/registry/requesters"],
  ["/departments", "/registry/departments"],
  ["/demand-types", "/registry/demand-types"],
  ["/tags", "/registry/tags"],
  ["/admin/tbcs", "/totvs/tbcs"],
  ["/admin/filters", "/totvs/backups"],
  ["/admin/backups", "/totvs/backups"],
  ["/admin/sentence-categories", "/totvs/sentence-categories"],
  ["/admin/sentences", "/totvs/sentences"],
  ["/admin/dataservers", "/totvs/dataservers"],
  ["/admin/processes", "/totvs/processes"],
  ["/admin/sistemas", "/totvs/systems"],
  ["/admin/soap-endpoints", "/totvs/soap/endpoints"],
  ["/soap", "/totvs/soap"],
  ["/integrations/tbc-reports", "/totvs/reports"],
  ["/integrations/ps-docs", "/rubeus/docs"],
  ["/integrations/ps-logic-docs", "/rubeus/logic-docs"],
  ["/integrations/ps-field-search", "/rubeus/field-search"],
  ["/integrations/ps-ficha-test", "/rubeus/form-tests"],
  ["/integrations/settings", "/admin/settings"],
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // next/image serves AVIF (WebP fallback), resized per `sizes`, lazy-loaded off-screen and cached
  // at the CDN/browser for a year (uploads are content-addressed, so a changed image has a new URL).
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    localPatterns: [{ pathname: "/storage/**" }, { pathname: "/uploads/**" }],
    minimumCacheTTL: 31536000,
  },
  // "use cache: remote" → Upstash Redis shared by every instance (falls back to memory without
  // UPSTASH_REDIS_REST_* / KV_REST_API_*). Plain "use cache" keeps Next's per-instance memory LRU.
  cacheHandlers: {
    remote: require.resolve("./cache-handlers/redis.mjs"),
  },
  // Profiles for cacheLife(): server revalidation of the shared caches. Mutations still invalidate
  // immediately through their tags (updateTag); these only bound how long an untouched entry lives.
  cacheLife: {
    /** Registries edited from their own screens (clients, TBCs, analysts…). */
    registries: { stale: 300, revalidate: 900, expire: 86_400 },
    /** Aggregates over demands/contracts (dashboard, filter options). */
    aggregates: { stale: 60, revalidate: 300, expire: 3_600 },
    /** External lookups that change rarely (TBC report catalogs). */
    external: { stale: 300, revalidate: 1_800, expire: 21_600 },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // @mui/material and lucide-react are optimized by default; the MUI X packages are not.
    optimizePackageImports: ["@mui/x-date-pickers", "@mui/x-charts"],
    // Client router cache: reuse a visited dynamic page for 30 s on back/forward-style navigations
    // (mutations clear it through updateTag/refresh), prefetched/static segments for 5 min.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  async redirects() {
    return LEGACY_ROUTES.map(([from, to]) => ({ source: `${from}/:path*`, destination: `${to}/:path*`, permanent: false }));
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/fonts/:path*", headers: IMMUTABLE },
      // Uploads stored locally in dev/Docker are content-hash named (lib/upload.ts) — never change.
      { source: "/storage/:path*", headers: IMMUTABLE },
      { source: "/:file(.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico))", headers: PUBLIC_ASSET },
    ];
  },
};

export default nextConfig;
