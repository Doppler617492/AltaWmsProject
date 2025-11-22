import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamsService } from './teams.service';
import { Patch } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  private ensureSupervisor(role: string) {
    if (!['admin','sef_magacina','menadzer'].includes(role)) {
      throw new BadRequestException('Samo admin/šef/menadžer');
    }
  }

  @Post()
  async create(@Req() req: any, @Body() body: { name: string }) {
    this.ensureSupervisor(req.user?.role || '');
    return this.service.createTeam(body?.name);
  }

  @Get()
  async list(@Req() req: any) {
    this.ensureSupervisor(req.user?.role || '');
    return this.service.listTeams();
  }

  @Post(':id/members')
  async addMembers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { user_ids: number[]; move?: boolean }
  ) {
    this.ensureSupervisor(req.user?.role || '');
    return this.service.addMembers(parseInt(id), body?.user_ids || [], !!body?.move);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    this.ensureSupervisor(req.user?.role || '');
    return this.service.removeMember(parseInt(id), parseInt(userId));
  }

  @Patch(':id')
  async rename(@Req() req: any, @Param('id') id: string, @Body() body: { name: string }) {
    this.ensureSupervisor(req.user?.role || '');
    return this.service.renameTeam(parseInt(id), String(body?.name||'').trim());
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    this.ensureSupervisor(req.user?.role || '');
    return this.service.deleteTeam(parseInt(id));
  }
}
