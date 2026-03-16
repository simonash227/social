import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Docker deployment on Railway
  output: 'standalone',
  // better-sqlite3, sharp, and node-cron are in Next.js 15's automatic
  // serverExternalPackages list — no manual config needed here.
  // Add only if additional native modules require it.
  serverExternalPackages: [],
}

export default nextConfig
