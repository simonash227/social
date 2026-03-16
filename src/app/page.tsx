export default function Home() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Infrastructure Validation Spike</h1>
      <p>This app validates Railway-specific infrastructure assumptions:</p>
      <ul>
        <li>SQLite WAL mode on a Railway volume mount</li>
        <li>better-sqlite3 native module compilation</li>
        <li>node-cron singleton via instrumentation.ts</li>
        <li>Satori + sharp PNG rendering on Linux</li>
      </ul>
      <p>
        <a href="/api/health">View health check → /api/health</a>
      </p>
    </main>
  )
}
