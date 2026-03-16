type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerOptions {
  threshold?: number  // failures before OPEN (default: 5)
  cooldown?: number   // ms before trying again (default: 300_000 = 5 min)
}

export class CircuitBreaker {
  private state: State = 'CLOSED'
  private failures = 0
  private openedAt: number | null = null

  constructor(
    private readonly service: string,
    private readonly opts: CircuitBreakerOptions = {}
  ) {}

  private get threshold() { return this.opts.threshold ?? 5 }
  private get cooldown() { return this.opts.cooldown ?? 300_000 }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.openedAt ?? 0)
      if (elapsed < this.cooldown) {
        throw new Error(
          `[circuit-breaker] ${this.service} is OPEN (${Math.round((this.cooldown - elapsed) / 1000)}s remaining)`
        )
      }
      this.state = 'HALF_OPEN'
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    this.failures = 0
    this.openedAt = null
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    if (this.failures >= this.threshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
      this.openedAt = Date.now()
      console.error(
        `[circuit-breaker] ${this.service} circuit OPENED after ${this.failures} failures`
      )
    }
  }
}

// Singleton registry — one breaker per service
const breakers = new Map<string, CircuitBreaker>()

export function getBreaker(service: string, opts?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(service)) {
    breakers.set(service, new CircuitBreaker(service, opts))
  }
  return breakers.get(service)!
}
