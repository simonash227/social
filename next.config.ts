import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Docker deployment on Railway
  output: 'standalone',
  // Native modules need explicit externalization for standalone builds
  serverExternalPackages: ['better-sqlite3', 'node-cron', 'pdf-parse', 'openai', 'rss-parser'],
}

export default nextConfig
