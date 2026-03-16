import 'server-only'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { getDb } from '@/db'
import { sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'

const SESSION_DAYS = 30

/**
 * Validates the submitted password against AUTH_PASSWORD env var.
 * Supports bcrypt-hashed passwords (starts with $2) or plaintext comparison.
 */
export async function validatePassword(input: string): Promise<boolean> {
  const stored = process.env.AUTH_PASSWORD
  if (!stored) throw new Error('AUTH_PASSWORD env var not set')

  // If stored starts with $2, it's a bcrypt hash; otherwise compare plaintext
  if (stored.startsWith('$2')) {
    return bcrypt.compare(input, stored)
  }
  return input === stored
}

/**
 * Creates a new session: inserts a DB row and sets httpOnly session cookie.
 */
export async function createSession(): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  const db = getDb()
  db.insert(sessions).values({
    token,
    expiresAt: expiresAt.toISOString(),
  }).run()

  // CRITICAL: cookies() is async in Next.js 15
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

/**
 * Deletes the current session from DB and removes the cookie.
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (token) {
    const db = getDb()
    db.delete(sessions).where(eq(sessions.token, token)).run()
  }
  cookieStore.delete('session')
}

/**
 * Refreshes a session's expiry date — called from middleware to extend on activity.
 */
export function refreshSession(token: string): void {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const db = getDb()
  db.update(sessions)
    .set({ expiresAt: expiresAt.toISOString() })
    .where(eq(sessions.token, token))
    .run()
}
