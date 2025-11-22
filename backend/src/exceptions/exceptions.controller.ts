import { Controller, Get, Param, Patch, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExceptionsService } from './exceptions.service';

@UseGuards(JwtAuthGuard)
@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Get('active')
  async getActive(@Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.exceptionsService.getActiveExceptions();
  }

  @Patch(':id/reassign')
  async reassign(
    @Param('id') id: string,
    @Body() body: { target_user_id?: number; team_id?: number },
    @Req() req: any,
  ) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    if (!body.target_user_id && !body.team_id) {
      throw new ForbiddenException('Morate izabrati radnika ili tim');
    }
    return this.exceptionsService.reassignException(id, body.target_user_id, body.team_id);
  }

  @Patch(':id/unhold')
  async unhold(@Param('id') id: string, @Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.exceptionsService.unholdException(id);
  }

  @Patch(':id/ack')
  async acknowledge(@Param('id') id: string, @Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.exceptionsService.acknowledgeException(id, req.user.id, req.user.role);
  }
}

