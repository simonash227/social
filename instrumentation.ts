export async function register() {
  // Only run in Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Singleton guard — instrumentation.ts register() can be called multiple times
  if ((globalThis as any).__cronRegistered) {
    console.log('[cron] Scheduler already registered, skipping')
    return
  }
  ;(globalThis as any).__cronRegistered = true

  // Lazy import to avoid bundling node-cron in Edge runtime
  const { default: cron } = await import('node-cron')

  // Tick every minute — validates cron fires in Railway's Linux environment
  cron.schedule('* * * * *', () => {
    console.log(`[cron] tick at ${new Date().toISOString()}`)
  })

  console.log('[cron] Scheduler registered')
}
