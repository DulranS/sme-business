import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/api-keys']
const AUTH_ROUTES = ['/login', '/signup']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Get the session from cookies (if using Supabase)
  const hasSession = request.cookies.has('sb-access-token')

  // Redirect to login if trying to access protected routes without session
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect to dashboard if logged in and trying to access auth routes
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api-keys/:path*', '/login', '/signup'],
}
