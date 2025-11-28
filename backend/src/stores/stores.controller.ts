import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException, Req, Query } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Store } from '../entities/store.entity';

@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async getAllStores(@Query('codes') codes?: string) {
    if (codes && codes.trim()) {
      const list = codes.split(',').map(c => c.trim()).filter(Boolean);
      return this.storesService.findByCodes(list);
    }
    return this.storesService.findAll();
  }

  @Get(':id')
  async getStore(@Param('id') id: string) {
    return this.storesService.findOne(parseInt(id));
  }

  @Post()
  async createStore(@Body() storeData: Partial<Store>, @Req() req: any) {
    // Only admin and menadzer can create stores
    const role = req.user?.role?.toLowerCase();
    if (!['admin', 'menadzer'].includes(role)) {
      throw new ForbiddenException('Samo admin i menadžer mogu kreirati prodavnice');
    }
    return this.storesService.create(storeData);
  }

  @Post('sync-from-cungu')
  async syncStoresFromCungu(@Req() req: any) {
    // Only admin and menadzer can sync stores
    const role = req.user?.role?.toLowerCase();
    if (!['admin', 'menadzer'].includes(role)) {
      throw new ForbiddenException('Samo admin i menadžer mogu sinhronizovati prodavnice');
    }
    return this.storesService.syncFromCungu();
  }

  @Post('sync-from-stock-api')
  async syncStoresFromStockAPI(@Req() req: any) {
    // Only admin and menadzer can sync stores
    const role = req.user?.role?.toLowerCase();
    if (!['admin', 'menadzer'].includes(role)) {
      throw new ForbiddenException('Samo admin i menadžer mogu sinhronizovati prodavnice');
    }
    return this.storesService.syncStoresFromStockAPI();
  }

  @Patch(':id')
  async updateStore(@Param('id') id: string, @Body() storeData: Partial<Store>, @Req() req: any) {
    const role = req.user?.role?.toLowerCase();
    if (!['admin', 'menadzer'].includes(role)) {
      throw new ForbiddenException('Samo admin i menadžer mogu izmeniti prodavnicu');
    }
    return this.storesService.update(parseInt(id), storeData);
  }

  @Delete(':id')
  async deleteStore(@Param('id') id: string, @Req() req: any) {
    const role = req.user?.role?.toLowerCase();
    if (!['admin', 'menadzer'].includes(role)) {
      throw new ForbiddenException('Samo admin i menadžer mogu obrisati prodavnicu');
    }
    await this.storesService.delete(parseInt(id));
    return { message: 'Prodavnica obrisana' };
  }
}


