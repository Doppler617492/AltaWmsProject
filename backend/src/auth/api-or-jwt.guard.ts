import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class ApiOrJwtGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization as string | undefined;
    const apiKey = (req.headers['x-api-key'] as string | undefined) || (req.headers['X-API-Key']);
    const wantPath: string = req?.route?.path || req?.url || '';

    // 1) Try JWT first
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      try {
        const user = await this.authService.validateToken(token);
        req.user = user;
        return true;
      } catch {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // 2) API Key fallback for analytics endpoints only
    const allowApiKey = !!process.env.ANALYTICS_API_KEY;
    const isAnalytics = typeof wantPath === 'string' && wantPath.includes('/workforce/analytics');
    if (allowApiKey && isAnalytics) {
      if (apiKey && apiKey === process.env.ANALYTICS_API_KEY) {
        // Mark as analytics client
        req.user = { id: 0, role: 'analytics' };
        return true;
      }
      throw new UnauthorizedException('Invalid API key');
    }

    // 3) Otherwise require JWT
    throw new UnauthorizedException('No auth');
  }
}

