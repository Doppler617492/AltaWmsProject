import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { Injectable } from '@nestjs/common';

/**
 * Default WebSocket gateway for root namespace '/'
 * Handles general Socket.IO connections and authentication
 */
@Injectable()
@WebSocketGateway({ 
  namespace: '/'
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from query or headers
      const token = (client.handshake.query['kioskToken'] as string) ||
                    (client.handshake.headers['x-kiosk-token'] as string) ||
                    (client.handshake.headers['authorization'] as string)?.replace('Bearer ', '') ||
                    '';

      if (!token) {
        // Allow connection without auth for now - specific namespaces can enforce
        console.log('[WS] Client connected without token:', client.id);
        return;
      }

      // Validate JWT token
      try {
        const user = await this.authService.validateToken(token);
        (client.data as any).user = user;
        console.log('[WS] Client authenticated:', client.id, user?.username);
      } catch (e) {
        // Token validation failed but allow connection - might be used elsewhere
        console.log('[WS] Client token validation failed:', client.id);
      }
    } catch (error) {
      console.error('[WS] Connection error:', error);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('[WS] Client disconnected:', client.id);
  }
}
