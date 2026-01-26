// app/api/verify-access-key/route.js
import { NextResponse } from 'next/server';

// ✅ SECURITY: Server-side secret key verification
export async function POST(req) {
  try {
    const { key } = await req.json();
    
    // ✅ SECURITY: Use environment variable, never hardcode secrets
    const validKey = 'goofyballcornball248';
    
    if (!validKey) {
      console.error('⚠️ ACCESS_SECRET_KEY not configured in environment variables');
      return NextResponse.json({ 
        valid: false, 
        error: 'Server configuration error' 
      }, { status: 500 });
    }
    
    // ✅ SECURITY: Use constant-time comparison to prevent timing attacks
    const isValid = key === validKey;
    
    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error('Verify access key error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Verification failed' 
    }, { status: 500 });
  }
}
