import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Req() req: any) {
    return this.usersService.list(req.user?.role || '');
  }

  @Post()
  async create(@Req() req: any, @Body() body: { full_name: string; username: string; password: string; role: string; shift: string; store_id?: number | null; }) {
    return this.usersService.create(req.user?.role || '', body);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: { full_name?: string; role?: string; shift?: string; active?: boolean; store_id?: number | null; }) {
    return this.usersService.update(req.user?.role || '', parseInt(id), body);
  }

  @Post(':id/reset-password')
  async resetPassword(@Req() req: any, @Param('id') id: string, @Body('new_password') newPassword: string) {
    return this.usersService.resetPassword(req.user?.role || '', parseInt(id), newPassword);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const actorRole = req.user?.role || '';
    const actorId = req.user?.id || req.user?.sub || 0;
    return this.usersService.remove(actorRole, actorId, parseInt(id));
  }
}
