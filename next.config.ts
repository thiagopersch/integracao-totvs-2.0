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
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // @mui/material and lucide-react are optimized by default; the MUI X packages are not.
    optimizePackageImports: ["@mui/x-date-pickers", "@mui/x-charts"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
