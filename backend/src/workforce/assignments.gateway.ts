import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

// Explicit path keeps socket.io reachable through reverse proxy at /socket.io
@WebSocketGateway({ namespace: '/ws/assignments', cors: { origin: '*'}, path: '/socket.io' })
export class AssignmentsGateway {
  @WebSocketServer()
  server: Server;

  broadcastNewAssignment(payload: any) {
    try {
      this.server.emit('assignment:new', payload);
    } catch {}
  }

  broadcastTaskCreated(payload: {
    type: 'RECEIVING' | 'SHIPPING' | 'SKART' | 'POVRACAJ';
    task_id: number;
    document_number?: string;
    order_number?: string;
    uid?: string;
    store_name?: string;
    supplier_name?: string;
    customer_name?: string;
    created_by_id?: number;
    created_by_name?: string;
    created_at: Date;
  }) {
    try {
      this.server.emit('task:created', payload);
    } catch {}
  }

  broadcastTaskCompleted(payload: {
    type: 'RECEIVING' | 'SHIPPING' | 'SKART' | 'POVRACAJ';
    task_id: number;
    document_number?: string;
    order_number?: string;
    uid?: string;
    worker_id?: number;
    worker_name?: string;
    team_id?: number;
    team_name?: string;
    completed_at: Date;
  }) {
    try {
      this.server.emit('task:completed', payload);
    } catch {}
  }
}
