import { OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PerformanceService } from './performance.service';

// Path set to /socket.io to align with Nginx upgrade route
@WebSocketGateway({ namespace: '/ws/performance', cors: { origin: '*' }, path: '/socket.io' })
export class PerformanceGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly perf: PerformanceService) {}

  onModuleInit() {
    this.server.use((socket, next) => {
      const headerToken = (socket.handshake.headers['x-kiosk-token'] as string) || '';
      const queryToken = (socket.handshake.query['kioskToken'] as string) || '';
    const expected = process.env.TV_KIOSK_TOKEN || '';
    if (expected && headerToken !== expected && queryToken !== expected) {
        return next(new Error('Unauthorized'));
      }
      next();
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
