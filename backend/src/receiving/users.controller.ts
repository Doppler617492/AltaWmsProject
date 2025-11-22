import { Controller, Get, UseGuards, ForbiddenException, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReceivingService } from './receiving.service';

@Controller('receiving')
@UseGuards(JwtAuthGuard)
export class ReceivingUsersController {
  constructor(private readonly receivingService: ReceivingService) {}

  // Alias endpoint for listing warehouse workers (magacioneri)
  // Intended for admin/menadzer/sef to assign/reassign work
  @Get('warehouse-workers')
  async getWarehouseWorkers(@Req() req: any) {
    const role = req.user?.role?.toLowerCase();
    const allowed = ['admin', 'menadzer', 'sef', 'sef_magacina'];
    if (!allowed.includes(role)) {
      throw new ForbiddenException('Pristup dozvoljen samo za admin/menadžer/šef.');
    }
    return this.receivingService.getAssignableWorkers();
  }
}
