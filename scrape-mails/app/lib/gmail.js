// Install: npm install googleapis
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const createOAuth2Client = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing Google OAuth credentials');
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback`
  );
};

export const getAuthUrl = () => {
  try {
    const oauth2Client = createOAuth2Client();

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw error;
  }
};

export const getTokensFromCode = async (code) => {
  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
};

export const createGmailClient = async (refreshToken) => {
  try {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        console.log('New refresh token received');
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    console.error('Error creating Gmail client:', error);
    throw error;
  }
};

export const testGmailConnection = async (gmailClient) => {
  try {
    const profile = await gmailClient.users.getProfile({ userId: 'me' });
    return { success: true, email: profile.data.emailAddress };
  } catch (error) {
    console.error('Gmail connection test failed:', error);
    return { success: false, error: error.message };
  }
};