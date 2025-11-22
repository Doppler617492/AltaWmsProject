import { Controller, Get, Post, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PutawayOptimizerService } from './putaway-optimizer.service';

@UseGuards(JwtAuthGuard)
@Controller('putaway')
export class PutawayOptimizerController {
  constructor(private readonly putawayOptimizerService: PutawayOptimizerService) {}

  @Get('suggestions/:receivingItemId')
  async getSuggestions(@Param('receivingItemId') receivingItemId: string, @Req() req: any) {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    return this.putawayOptimizerService.getSuggestions(
      parseInt(receivingItemId),
      userId,
      userRole,
    );
  }

  @Post('apply')
  async applySuggestion(
    @Body() body: { receiving_item_id: number; location_code: string; quantity: number },
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;

    return this.putawayOptimizerService.applySuggestion(
      body.receiving_item_id,
      body.location_code,
      body.quantity,
      userId,
      userRole,
    );
  }
}

