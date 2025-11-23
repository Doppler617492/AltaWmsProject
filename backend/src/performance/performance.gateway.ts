import { OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PerformanceService } from './performance.service';
import { AuthService } from '../auth/auth.service';

// Namespace /ws/performance for performance socket events
@WebSocketGateway({ namespace: '/ws/performance' })
export class PerformanceGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly perf: PerformanceService, private readonly authService: AuthService) {}

  onModuleInit() {
    this.server.use(async (socket, next) => {
      const headerToken = (socket.handshake.headers['x-kiosk-token'] as string) || '';
      const queryToken = (socket.handshake.query['kioskToken'] as string) || '';
      const bearer = (socket.handshake.headers['authorization'] as string) || '';
      const bearerToken = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
      const provided = headerToken || queryToken || bearerToken || '';
      const expected = process.env.TV_KIOSK_TOKEN || '';

      // Allow if kiosk token matches or no kiosk token is configured
      if (!expected || provided === expected) {
        return next();
      }

      // Fallback: allow valid JWT (e.g. admin UI)
      if (provided && provided.split('.').length === 3) {
        try {
          const user = await this.authService.validateToken(provided);
          (socket.data as any).user = user;
          return next();
        } catch (e) {
          return next(new Error('Unauthorized'));
        }
      }

      return next(new Error('Unauthorized'));
    });

    // Push current snapshot on connection
    this.server.on('connection', async (sock) => {
      try { const snap = await this.perf.getOverview(); sock.emit('performance:update', snap); } catch {}
    });

    // Subscribe to updates from service
    this.perf.onUpdate((snap) => {
      this.server.emit('performance:update', snap);
    });
  }
}
