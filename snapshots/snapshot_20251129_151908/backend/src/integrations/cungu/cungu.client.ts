import { Injectable, Logger } from '@nestjs/common';
import {
  CunguApiErrorResponse,
  CunguClientOptions,
  CunguLoginResponse,
  CunguRequestPayload,
} from './cungu.types';

interface CachedToken {
  value: string;
  expiresAt: number;
}

@Injectable()
export class CunguClient {
  private readonly logger = new Logger(CunguClient.name);
  private readonly baseUrl: string;
  private readonly tokenTtlMs: number;
  private cachedTokens: Map<string, CachedToken> = new Map(); // key: "username:password"
  private ongoingAuthPromises: Map<string, Promise<void>> = new Map();
  private readonly maxRetries = 3;

  constructor() {
    this.baseUrl = process.env.CUNGU_API_BASE_URL || process.env.CUNGU_API_URL || 'http://cungu.pantheonmn.net:3003';
    this.tokenTtlMs = process.env.CUNGU_API_TOKEN_TTL
      ? Number(process.env.CUNGU_API_TOKEN_TTL)
      : 55 * 60 * 1000; // 55 minutes default
  }

  /**
   * Issues a POST /get request against the Cungu API with the specified credentials.
   * Automatically hydrates / refreshes the auth token before performing the call.
   * @param payload The request payload
   * @param apiType Either 'documents' (uses CunguWMS credentials) or 'stock' (uses TestCungu credentials)
   */
  async postGet<TResponse>(payload: CunguRequestPayload, apiType: 'documents' | 'stock' = 'documents'): Promise<TResponse> {
    const credentials = this.resolveCredentials(apiType);
    await this.ensureToken(credentials);
    return this.performPost<TResponse>(payload, credentials, 0);
  }

  private resolveCredentials(apiType: 'documents' | 'stock'): { username: string; password: string } {
    if (apiType === 'stock') {
      // Stock API uses TestCungu/webshopapi24
      return {
        username: process.env.CUNGU_STOCK_API_USERNAME || 'TestCungu',
        password: process.env.CUNGU_STOCK_API_PASSWORD || 'webshopapi24',
      };
    } else {
      // Document API (receiving/shipping) uses CunguWMS credentials
      return {
        username: process.env.CUNGU_API_USERNAME || 'CunguWMS',
        password: process.env.CUNGU_API_PASSWORD || 'C!g#2W4s5#$M6',
      };
    }
  }

  private getTokenCacheKey(credentials: { username: string; password: string }): string {
    return `${credentials.username}:${credentials.password}`;
  }

  private async ensureToken(credentials: { username: string; password: string }): Promise<void> {
    const key = this.getTokenCacheKey(credentials);
    const cached = this.cachedTokens.get(key);
    
    if (cached && Date.now() < cached.expiresAt - 30_000) {
      return;
    }

    let authPromise = this.ongoingAuthPromises.get(key);
    if (!authPromise) {
      authPromise = this.authenticate(credentials).finally(() => {
        this.ongoingAuthPromises.delete(key);
      });
      this.ongoingAuthPromises.set(key, authPromise);
    }

    await authPromise;
  }

  private async authenticate(credentials: { username: string; password: string }): Promise<void> {
    const key = this.getTokenCacheKey(credentials);
    this.logger.debug(`Authenticating against Cungu API with username: ${credentials.username}`);
    
    const loginUrl = `${this.baseUrl.replace(/\/$/, '')}/login`;
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cungu login failed for ${credentials.username} (${response.status}): ${text || 'Unknown error'}`);
    }

    const json = (await response.json()) as CunguLoginResponse;
    if (!json?.token) {
      throw new Error('Cungu login response missing token');
    }

    this.cachedTokens.set(key, {
      value: json.token,
      expiresAt: Date.now() + this.tokenTtlMs,
    });

    this.logger.debug(`Cungu API authentication successful for ${credentials.username} - Token: ${json.token.substring(0, 50)}...`);
  }

  private async performPost<TResponse>(
    payload: CunguRequestPayload,
    credentials: { username: string; password: string },
    retryCount: number = 0,
  ): Promise<TResponse> {
    const key = this.getTokenCacheKey(credentials);
    const cachedToken = this.cachedTokens.get(key);
    
    const body = JSON.stringify(payload);
    const getUrl = `${this.baseUrl.replace(/\/$/, '')}/get`;
    
    // DEBUG: Log request details
    this.logger.debug(`Making request to ${getUrl} with user ${credentials.username}`);
    this.logger.debug(`Payload: ${body}`);
    this.logger.debug(`Token (first 20 chars): ${cachedToken?.value.substring(0, 20)}...`);
    
    const response = await fetch(getUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cachedToken?.value}`,
      },
      body,
    });
    
    this.logger.debug(`Response status: ${response.status}`);

    if (response.status === 401) {
      if (retryCount >= this.maxRetries) {
        this.logger.error(`Max retries (${this.maxRetries}) exceeded for 401 errors with ${credentials.username}. Credentials may be invalid.`);
        throw new Error(`Authentication failed after multiple retries for ${credentials.username}. Please check Cungu API credentials.`);
      }
      
      this.logger.warn(`Received 401 from Cungu API for ${credentials.username} – refreshing token and retrying (attempt ${retryCount + 1}/${this.maxRetries})`);
      
      // Force token to be considered expired
      const cached = this.cachedTokens.get(key);
      if (cached) {
        cached.expiresAt = 0;
      }
      await this.ensureToken(credentials);
      
      // Retry with incremented counter
      return this.performPost<TResponse>(payload, credentials, retryCount + 1);
    }

    if (!response.ok) {
      const text = await response.text();
      let parsed: CunguApiErrorResponse | string = text;
      try {
        parsed = JSON.parse(text) as CunguApiErrorResponse;
      } catch {
        // noop
      }

      // Handle "No data found" as empty result instead of error
      if (response.status === 404 && typeof parsed === 'object' && parsed.errorCode === 3011) {
        this.logger.debug(`No data found for method ${payload.method} - returning empty array`);
        return [] as TResponse;
      }

      this.logger.error(
        `Cungu API error [${response.status}] for method ${payload.method} with user ${credentials.username}: ${text}`,
      );
      throw new Error(
        `Cungu API error (${response.status}): ${
          typeof parsed === 'string' ? parsed : parsed.message
        }`,
      );
    }

    const json = (await response.json()) as TResponse;
    return json;
  }
}


