import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private itemsService: ItemsService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    return this.itemsService.findAll(search);
  }

  @Get(':id/stock')
  async getStock(@Param('id') id: string) {
    return this.itemsService.getStock(+id);
  }
}
