import { NextResponse } from 'next/server'
import { validatePassword, createSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body as { password?: string }

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    let valid: boolean
    try {
      valid = await validatePassword(password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auth configuration error'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    await createSession()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
