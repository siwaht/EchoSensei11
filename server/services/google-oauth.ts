import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.js';
import { googleOAuthTokens } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// OAuth2 scopes for Google services
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

// Encryption key for storing tokens (in production, use env variable)
const ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

class GoogleOAuthService {
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    // Only initialize OAuth2Client if credentials are available
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
      );
    }
  }

  // Check if OAuth is configured
  isConfigured(): boolean {
    return this.oauth2Client !== null;
  }

  // Generate authorization URL
  getAuthUrl(state: string): string {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      state: state,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Get user info from Google
  async getUserInfo(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }
    
    return response.json();
  }

  // Encrypt token for storage
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  // Decrypt token from storage
  private decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Save tokens to database
  async saveTokens(
    organizationId: string,
    userId: string,
    email: string,
    tokens: any
  ) {
    const encryptedAccessToken = this.encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? this.encryptToken(tokens.refresh_token) : null;
    
    // Check if tokens already exist for this user
    const existingTokens = await db
      .select()
      .from(googleOAuthTokens)
      .where(
        and(
          eq(googleOAuthTokens.organizationId, organizationId),
          eq(googleOAuthTokens.userId, userId)
        )
      );

    if (existingTokens.length > 0) {
      // Update existing tokens
      await db
        .update(googleOAuthTokens)
        .set({
          email,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scope: tokens.scope || GOOGLE_SCOPES.join(' '),
          updatedAt: new Date(),
        })
        .where(eq(googleOAuthTokens.id, existingTokens[0].id));
        
      return existingTokens[0].id;
    } else {
      // Insert new tokens
      const [newToken] = await db
        .insert(googleOAuthTokens)
        .values({
          organizationId,
          userId,
          email,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scope: tokens.scope || GOOGLE_SCOPES.join(' '),
        })
        .returning();
        
      return newToken.id;
    }
  }

  // Get tokens from database
  async getStoredTokens(organizationId: string, userId: string) {
    const [tokenRecord] = await db
      .select()
      .from(googleOAuthTokens)
      .where(
        and(
          eq(googleOAuthTokens.organizationId, organizationId),
          eq(googleOAuthTokens.userId, userId)
        )
      );

    if (!tokenRecord) {
      return null;
    }

    // Check if token is expired
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
      // Token is expired, try to refresh it
      if (tokenRecord.refreshToken) {
        try {
          const decryptedRefreshToken = this.decryptToken(tokenRecord.refreshToken);
          if (!this.oauth2Client) {
            throw new Error('Google OAuth is not configured');
          }
          this.oauth2Client.setCredentials({ refresh_token: decryptedRefreshToken });
          
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          
          // Update tokens in database
          await this.saveTokens(
            organizationId,
            userId,
            tokenRecord.email,
            credentials
          );
          
          return {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || decryptedRefreshToken,
            email: tokenRecord.email,
          };
        } catch (error) {
          console.error('Failed to refresh token:', error);
          return null;
        }
      }
      return null;
    }

    return {
      accessToken: this.decryptToken(tokenRecord.accessToken),
      refreshToken: tokenRecord.refreshToken ? this.decryptToken(tokenRecord.refreshToken) : null,
      email: tokenRecord.email,
    };
  }

  // Remove tokens from database
  async removeTokens(organizationId: string, userId: string) {
    await db
      .delete(googleOAuthTokens)
      .where(
        and(
          eq(googleOAuthTokens.organizationId, organizationId),
          eq(googleOAuthTokens.userId, userId)
        )
      );
  }

  // Check if user has valid Google tokens
  async hasValidTokens(organizationId: string, userId: string): Promise<boolean> {
    const tokens = await this.getStoredTokens(organizationId, userId);
    return tokens !== null;
  }

  // Make authenticated request to Google API
  async makeAuthenticatedRequest(
    organizationId: string,
    userId: string,
    url: string,
    options: RequestInit = {}
  ) {
    const tokens = await this.getStoredTokens(organizationId, userId);
    
    if (!tokens) {
      throw new Error('No valid Google tokens found. Please authenticate with Google first.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Google authentication expired. Please re-authenticate.');
      }
      throw new Error(`Google API request failed: ${response.statusText}`);
    }

    return response;
  }
}

export const googleOAuthService = new GoogleOAuthService();