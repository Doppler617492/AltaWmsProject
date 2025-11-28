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
  private readonly loginUrl: string;
  private readonly getUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly tokenTtlMs: number;

  private cachedToken: CachedToken | null = null;
  private ongoingAuth: Promise<void> | null = null;
  private readonly maxRetries = 3;

  constructor() {
    const options = this.resolveOptions();
    this.loginUrl = `${options.baseUrl.replace(/\/$/, '')}/login`; // Stock API uses /login
    this.getUrl = `${options.baseUrl.replace(/\/$/, '')}/get`;
    this.username = options.username;
    this.password = options.password;
    this.tokenTtlMs = options.tokenTtlMs ?? 55 * 60 * 1000; // 55 minutes default
  }

  /**
   * Issues a POST /get request against the Cungu API.
   * Automatically hydrates / refreshes the auth token before performing the call.
   */
  async postGet<TResponse>(payload: CunguRequestPayload): Promise<TResponse> {
    await this.ensureToken();
    return this.performPost<TResponse>(payload, 0);
  }

  private resolveOptions(): CunguClientOptions {
    const baseUrl = process.env.CUNGU_API_BASE_URL || process.env.CUNGU_API_URL || 'http://cungu.pantheonmn.net:3003';
    
    // Stock API uses different credentials (TestCungu/webshopapi24)
    // Document API uses CunguWMS credentials
    const username = process.env.CUNGU_STOCK_API_USERNAME || process.env.CUNGU_API_USERNAME || 'TestCungu';
    const password = process.env.CUNGU_STOCK_API_PASSWORD || process.env.CUNGU_API_PASSWORD || 'webshopapi24';
    
    const tokenTtlMs = process.env.CUNGU_API_TOKEN_TTL
      ? Number(process.env.CUNGU_API_TOKEN_TTL)
      : undefined;

    this.logger.log(`Cungu API Config: URL=${baseUrl}, Username=${username}`);
    
    return { baseUrl, username, password, tokenTtlMs };
  }

  private async ensureToken(): Promise<void> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 30_000) {
      return;
    }

    if (!this.ongoingAuth) {
      this.ongoingAuth = this.authenticate().finally(() => {
        this.ongoingAuth = null;
      });
    }

    await this.ongoingAuth;
  }

  private async authenticate(): Promise<void> {
    this.logger.debug('Authenticating against Cungu Stock API…');
    const response = await fetch(this.loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
        // Stock API does NOT require 'db' parameter (only username/password)
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cungu login failed (${response.status}): ${text || 'Unknown error'}`);
    }

    const json = (await response.json()) as CunguLoginResponse;
    if (!json?.token) {
      throw new Error('Cungu login response missing token');
    }

    this.cachedToken = {
      value: json.token,
      expiresAt: Date.now() + this.tokenTtlMs,
    };

    this.logger.debug(`Cungu API authentication successful - Token: ${json.token.substring(0, 50)}...`);
  }

  private async performPost<TResponse>(payload: CunguRequestPayload, retryCount: number = 0): Promise<TResponse> {
    const body = JSON.stringify(payload);
    
    // DEBUG: Log request details
    this.logger.debug(`Making request to ${this.getUrl}`);
    this.logger.debug(`Payload: ${body}`);
    this.logger.debug(`Token (first 20 chars): ${this.cachedToken?.value.substring(0, 20)}...`);
    
    const response = await fetch(this.getUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cachedToken?.value}`,
      },
      body,
    });
    
    this.logger.debug(`Response status: ${response.status}`);

    if (response.status === 401) {
      if (retryCount >= this.maxRetries) {
        this.logger.error(`Max retries (${this.maxRetries}) exceeded for 401 errors. Credentials may be invalid.`);
        throw new Error('Authentication failed after multiple retries. Please check Cungu API credentials.');
      }
      
      this.logger.warn(`Received 401 from Cungu API – refreshing token and retrying (attempt ${retryCount + 1}/${this.maxRetries})`);
      
      // Force token to be considered expired so ensureToken() will refresh it
      // But do this atomically by setting the expiry time to 0 instead of nulling the token
      // This prevents race conditions where multiple requests all null the token simultaneously
      if (this.cachedToken) {
        this.cachedToken.expiresAt = 0;
      }
      await this.ensureToken();
      
      // Retry with incremented counter
      return this.performPost<TResponse>(payload, retryCount + 1);
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
        `Cungu API error [${response.status}] for method ${payload.method}: ${text}`,
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


