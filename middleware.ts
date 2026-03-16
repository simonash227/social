import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { sessions } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export const config = {
  runtime: 'nodejs', // Stable in Next.js 15.5 — enables better-sqlite3 in middleware
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/health|api/auth).*)',
  ],
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const db = getDb()
  const session = db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date().toISOString())
      )
    )
    .get()

  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }

  // Refresh session expiry on each valid request (rolling 30-day window)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  db.update(sessions)
    .set({ expiresAt: expiresAt.toISOString() })
    .where(eq(sessions.token, token))
    .run()

  return NextResponse.next()
}
