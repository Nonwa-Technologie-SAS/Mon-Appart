import path from "node:path"
import type { NextConfig } from "next"

const isProd = process.env.NODE_ENV === "production"

const nestApiUrl = (
  process.env.NEST_API_URL ??
  process.env.NEXT_PUBLIC_NEST_API_URL ??
  "http://localhost:4000"
)
  .replace(/\/+$/, "")
  .replace(/^same-origin$/i, "http://localhost:4000")

const nestImageRemotePattern = (() => {
  try {
    const url = new URL(
      nestApiUrl === "/" ? "http://localhost:4000" : nestApiUrl,
    )
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/api/v1/media/**" as const,
    }
  } catch {
    return null
  }
})()

/**
 * CSP adaptée à Next.js App Router (scripts/styles inline nécessaires au
 * bootstrap). À durcir progressivement (nonces) une fois mesurée en prod.
 * `connect-src` autorise Nest en same-origin (rewrite) + http localhost en dev.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  isProd
    ? "img-src 'self' data: blob: https:"
    : "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
  "font-src 'self' data:",
  isProd
    ? "connect-src 'self' https: wss:"
    : `connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws: wss:`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
].join("; ")

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace monorepo (pnpm) pour l'image Docker Contabo.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "90mb",
    },
    proxyClientMaxBodySize: "90mb",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
      ...(nestImageRemotePattern ? [nestImageRemotePattern] : []),
    ],
  },
  // Nest same-origin : cookies ma_* + CSRF. Blob upload reste local (Vercel).
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${nestApiUrl}/api/v1/:path*`,
      },
    ]
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self)",
      },
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
    ]
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      })
    }
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
