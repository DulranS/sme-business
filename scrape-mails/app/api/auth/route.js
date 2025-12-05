// app/api/auth/route.js
import { getAuthUrl } from '@/app/lib/gmail';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}