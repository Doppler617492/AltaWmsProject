import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard, ReceivingRolesGuard } from './roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: (() => {
        const secret = process.env.JWT_SECRET || 'samo-za-dev';
        if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || secret === 'samo-za-dev')) {
          throw new Error('JWT_SECRET must be set in production');
        }
        return secret;
      })(),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, ReceivingRolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, ReceivingRolesGuard],
})
export class AuthModule {}
