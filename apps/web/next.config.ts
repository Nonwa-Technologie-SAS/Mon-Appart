import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth"],
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
    ],
  },
}

export default nextConfig

