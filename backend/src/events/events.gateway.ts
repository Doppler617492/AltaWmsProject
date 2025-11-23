import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/events', cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit() {
    // Emit a periodic heartbeat so clients can verify connectivity
    setInterval(() => {
      try {
        this.server.emit('events:heartbeat', { ts: Date.now() });
      } catch {}
    }, 15000);
  }
}
