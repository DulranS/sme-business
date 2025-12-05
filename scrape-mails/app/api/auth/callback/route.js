// Install: npm install googleapis
import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    if (error) {
      console.error('OAuth error:', error);
      redirect('/?auth=cancelled');
    }
    
    if (!code) {
      return Response.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      console.error('No refresh token received');
      redirect('/?auth=error&message=no_refresh_token');
    }

    const cookieStore = await cookies();
    cookieStore.set('refresh_token', tokens.refresh_token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/'
    });

    if (tokens.expiry_date) {
      cookieStore.set('token_expiry', tokens.expiry_date.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/'
      });
    }

    redirect('/?auth=success');
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    if (error.message?.includes('invalid_grant')) {
      redirect('/?auth=error&message=invalid_code');
    }
    
    redirect('/?auth=error&message=unknown');
  }
}