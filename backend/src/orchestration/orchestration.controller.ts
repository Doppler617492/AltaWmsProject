import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrchestrationService } from './orchestration.service';

@UseGuards(JwtAuthGuard)
@Controller('orchestration')
export class OrchestrationController {
  constructor(private readonly orchestrationService: OrchestrationService) {}

  @Get('recommendations')
  async getRecommendations(@Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role?.toLowerCase())) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.orchestrationService.getRecommendations();
  }

  @Post('execute')
  async execute(
    @Body() body: {
      exception_id: string;
      action_type: string;
      payload: any;
    },
    @Req() req: any,
  ) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role?.toLowerCase())) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    return this.orchestrationService.executeAction(
      body.exception_id,
      body.action_type,
      body.payload,
      req.user.id,
    );
  }
}

