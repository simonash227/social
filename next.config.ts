import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3, sharp, and node-cron are in Next.js 15's automatic
  // serverExternalPackages list — no manual config needed here.
  // Add only if additional native modules require it.
  serverExternalPackages: [],
}

export default nextConfig
