import path from "node:path"
import type { NextConfig } from "next"

const apiUrl = (process.env.ADMIN_API_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  "",
)

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Même origine pour le navigateur : cookies HttpOnly (refresh) et CSRF de
  // l'API restent valables, sans CORS ni jeton dans le stockage local.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }]
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production"
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self'",
        ].join("; "),
      },
    ]
    if (isProd) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      })
    }
    return [{ source: "/:path*", headers }]
  },
}

export default nextConfig
