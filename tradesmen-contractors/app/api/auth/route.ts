import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret")
  if (secret === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ authorized: true })
  }
  return NextResponse.json({ authorized: false }, { status: 401 })
}