import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import { IoAdapter } from '@nestjs/platform-socket.io';

class SocketIoAdapter extends IoAdapter {
  constructor(app: any, private readonly allowedOrigins: string[]) {
    super(app);
  }

  createIOServer(port: number, options?: any) {
    const opts = {
      ...(options || {}),
      path: '/socket.io',
      cors: {
        origin: this.allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 60000,
    };
    const server = super.createIOServer(port, opts);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // Health check endpoint
  app.use('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  // Enable CORS for frontend and future Zebra handheld
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3003', // Admin frontend
        'http://frontend:3000',
        'http://localhost:8080', // PWA frontend
        'http://localhost:8090', // TV wallboard
        'http://zebra:8080',       // Future Zebra handheld in Docker
        'https://admin.cungu.com',
        'https://pwa.cungu.com',
        'https://tv.cungu.com',
        'https://api.cungu.com',
        'https://cungu.com',
        'http://alta-wms-frontend-admin:3000',
        'http://alta-wms-frontend-pwa:3000',
      ];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Kiosk-Token', 'x-kiosk-token'],
  });

  // Serve uploaded files statically under /uploads
  const uploadsPath = join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));
  
  const port = process.env.PORT || 8000;
  // Ensure Socket.IO uses the same HTTP server and path /socket.io
  app.useWebSocketAdapter(new SocketIoAdapter(app, allowedOrigins));
  await app.listen(port as number, '0.0.0.0');
  
  // Structured logging instead of console.log
  const logger = app.get('Logger', console);
  logger.log(`🚀 Alta WMS Backend listening on port ${port}`, 'Bootstrap');
  logger.log(`✅ Health check available at /health`, 'Bootstrap');
}
bootstrap();
