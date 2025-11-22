import { Body, Controller, Get, Param, UseGuards, Req, ForbiddenException, Query, Res, Post } from '@nestjs/common';
import { Response } from 'express';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private stockService: StockService) {}

  // FAZA 5.1 — RBAC helpers
  private ensureRole(role: string, allowed: string[]) {
    const normalized = (role || '').toLowerCase();
    const allowedSet = allowed.map(r => r.toLowerCase());
    if (!allowedSet.includes(normalized)) throw new ForbiddenException('Zabranjen pristup');
  }

  // 1) Pregled po artiklu
  @Get('by-item')
  async byItem(@Req() req: any, @Query('sku') sku?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin','menadzer','sef_magacina']);
    return this.stockService.getByItem({ sku: sku || undefined, limit: limit ? parseInt(limit) : undefined, offset: offset ? parseInt(offset) : undefined });
  }

  // 2) Pregled po lokaciji
  @Get('by-location')
  async byLocation(@Req() req: any, @Query('location_code') locationCode: string) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin','menadzer','sef_magacina']);
    return this.stockService.getByLocationCode(locationCode);
  }

  // Inventory overview computed from inventory_movements
  @Get('inventory')
  async getInventoryOverview() {
    return this.stockService.getInventoryOverview();
  }

  // Items and quantities at a specific location
  @Get('locations')
  async getAllLocationBalances() {
    return this.stockService.getAllLocationBalances();
  }

  @Get('locations/detail')
  async getLocationsDetail() {
    return this.stockService.getInventoryOverview();
  }

  @Get('location/:id')
  async getLocation(@Param('id') id: string) {
    return this.stockService.getLocationDetail(parseInt(id));
  }

  // By-document inventory impact (admin/menadzer/sef/magacioner)
  @Get('inventory/by-document/:id')
  async getByDocument(@Param('id') id: string, @Req() req: any) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    const allowed = ['admin', 'menadzer', 'sef', 'sef_magacina', 'magacioner'];
    if (!allowed.includes(role)) {
      throw new ForbiddenException('Pristup dozvoljen samo za admin/menadžer/šef/magacioner');
    }
    return this.stockService.getInventoryByDocument(parseInt(id));
  }

  // 3) Movements list
  @Get('movements')
  async movements(
    @Req() req: any,
    @Query('since') since?: string,
    @Query('location_code') locationCode?: string,
    @Query('item_sku') itemSku?: string,
    @Query('limit') limit?: string,
  ) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin','menadzer','sef_magacina']);
    return this.stockService.getMovements({ since, locationCode, itemSku, limit: limit ? parseInt(limit) : 50 });
  }

  // 4) Hotspots (admin i sef_magacina)
  @Get('hotspots')
  async hotspots(@Req() req: any) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin','sef_magacina']);
    return this.stockService.getHotspots();
  }

  @Get('pantheon/items')
  async pantheonItems(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin', 'menadzer', 'sef_magacina', 'sef', 'sef_prodavnice']);
    return this.stockService.getPantheonItems({
      search: search || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('pantheon/sync')
  async pantheonSync(@Req() req: any, @Body() body: { full?: boolean; force?: boolean } = {}) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin', 'menadzer']);
    return this.stockService.syncPantheonItems({ full: !!body.full, force: !!body.force });
  }

  // Movements CSV export
  @Get('movements/export')
  async movementsExport(
    @Req() req: any,
    @Res() res: Response,
    @Query('since') since?: string,
    @Query('location_code') locationCode?: string,
    @Query('item_sku') itemSku?: string,
    @Query('limit') limit?: string,
  ) {
    const role = (req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || '').toString();
    this.ensureRole(role, ['admin','menadzer','sef_magacina']);
    const rows = await this.movements(req, since, locationCode, itemSku, limit);
    const header = ['timestamp','user_full_name','reason','item_sku','item_name','quantity_change','from_location_code','to_location_code','reference_document_number'];
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat((rows as any[]).map(r => header.map(h => esc(r[h])).join(',')));
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="movements.csv"');
    return res.send(csv);
  }
}
