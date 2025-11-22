import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Post('login')
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.authService.validateUser(loginDto.username, loginDto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    // Load full user from DB to include last_activity
    const dbUser = await this.userRepo.findOne({ where: { id: req.user.id }, relations: ['store'] });
    const base = {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      roles: req.user.roles || [],
      permissions: req.user.permissions || [],
    };
    if (dbUser) {
      return {
        ...base,
        full_name: (dbUser as any).full_name || dbUser.name || req.user.name,
        name: (dbUser as any).full_name || dbUser.name || req.user.name,
        last_activity: dbUser.last_activity || null,
        store_id: dbUser.store_id || null,
        store_name: dbUser.store?.name || null,
        store_code: dbUser.store?.code || null,
      };
    }
    return base;
  }
}
