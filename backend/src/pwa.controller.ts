import { Controller, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('pwa')
export class PwaController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Patch('heartbeat')
  async heartbeat(@Req() req: any, @Body('device_id') deviceId?: string) {
    const userId = req.user?.id;
    if (userId) {
      await this.userRepository.update({ id: userId }, { last_activity: new Date() });
    }
    return { ok: true, at: new Date().toISOString() };
  }
}

