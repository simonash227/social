import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/health|api/auth).*)',
  ],
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Session cookie exists — let the request through.
  // Full session validation (expiry, DB lookup) happens in server components.
  return NextResponse.next()
}
