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

  constructor() {
    const options = this.resolveOptions();
    this.loginUrl = `${options.baseUrl.replace(/\/$/, '')}/login`;
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
    return this.performPost<TResponse>(payload);
  }

  private resolveOptions(): CunguClientOptions {
    const baseUrl = process.env.CUNGU_API_BASE_URL || 'http://cungu.pantheonmn.net:3003';
    const username = process.env.CUNGU_API_USERNAME || 'CunguWMS';
    const password = process.env.CUNGU_API_PASSWORD || 'C!g#2W4s5#$M6';
    const tokenTtlMs = process.env.CUNGU_API_TOKEN_TTL
      ? Number(process.env.CUNGU_API_TOKEN_TTL)
      : undefined;

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
    this.logger.debug('Authenticating against Cungu API…');
    const response = await fetch(this.loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
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

    this.logger.debug('Cungu API authentication successful');
  }

  private async performPost<TResponse>(payload: CunguRequestPayload): Promise<TResponse> {
    const body = JSON.stringify(payload);
    const response = await fetch(this.getUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cachedToken?.value}`,
      },
      body,
    });

    if (response.status === 401) {
      this.logger.warn('Received 401 from Cungu API – refreshing token and retrying');
      this.cachedToken = null;
      await this.ensureToken();
      return this.performPost<TResponse>(payload);
    }

    if (!response.ok) {
      const text = await response.text();
      let parsed: CunguApiErrorResponse | string = text;
      try {
        parsed = JSON.parse(text) as CunguApiErrorResponse;
      } catch {
        // noop
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


