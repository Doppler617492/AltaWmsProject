import { Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShippingService } from './shipping.service';
import * as multer from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('shipping')
export class ShippingController {
  constructor(private svc: ShippingService) {}

  @Post('order')
  async create(@Body() body: any, @Req() req: any) {
    return this.svc.createOrder(body, req.user);
  }

  @Patch('order/:id/start')
  async start(@Param('id') id: string, @Body() body: any) {
    return this.svc.startOrder(Number(id), body.assigned_user_id);
  }

  @Get('active')
  async active() {
    return this.svc.listActive();
  }

  @Get('order/:id')
  async detail(@Param('id') id: string) {
    return this.svc.getOrderDetail(Number(id));
  }

  @Get('summary')
  async summary() {
    return this.svc.getSummary();
  }

  @Get('my-orders')
  async myOrders(@Req() req: any) {
    return this.svc.myOrders(req.user.id);
  }

  @Patch('line/:lineId/pick')
  async pick(@Param('lineId') lineId: string, @Body() body: any, @Req() req: any) {
    return this.svc.pickLine(Number(lineId), req.user.id, Number(body.picked_qty), body.from_location_code, body.reason || null);
  }

  @Patch('order/:id/stage')
  async stage(@Param('id') id: string, @Req() req: any) {
    return this.svc.stageOrder(Number(id), req.user.id);
  }

  @Patch('order/:id/finish-pwa')
  async finishFromPwa(@Param('id') id: string, @Req() req: any) {
    return this.svc.finishOrderFromPwa(Number(id), req.user.id);
  }

  @Patch('order/:id/load')
  async load(@Param('id') id: string) {
    return this.svc.loadOrder(Number(id));
  }

  @Patch('order/:id/close')
  async close(@Param('id') id: string) {
    return this.svc.closeOrder(Number(id));
  }

  @Delete('order/:id')
  async deleteOrder(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteOrder({ id: req.user?.id, role: req.user?.role }, Number(id));
  }

  @Post('orders/bulk-delete')
  async deleteOrdersBulk(@Body() body: { orderIds: number[] }, @Req() req: any) {
    if (!Array.isArray(body?.orderIds)) {
      throw new BadRequestException('orderIds mora biti niz');
    }
    return this.svc.deleteOrdersBulk({ id: req.user?.id, role: req.user?.role }, body.orderIds);
  }

  @Delete('line/:lineId')
  async deleteLine(@Param('lineId') lineId: string, @Req() req: any) {
    return this.svc.deleteLine({ id: req.user?.id, role: req.user?.role }, Number(lineId));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async importFromPantheon(
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    const customerName = body.customer_name || '';
    const previewOnly = String(body?.preview ?? req.query?.preview ?? '').toLowerCase() === 'true';
    try {
      return await this.svc.importFromPantheon(file, customerName, req.user.id, previewOnly);
    } catch (e: any) {
      console.error('Shipping import error:', e?.message || e);
      throw new BadRequestException(e?.message || 'Import nije uspeo');
    }
  }

  @Post('import-json')
  async importFromJson(@Body() body: any, @Req() req: any) {
    try {
      return await this.svc.importFromJson(body, req.user.id);
    } catch (e: any) {
      console.error('Shipping import-json error:', e?.message || e);
      throw new BadRequestException(e?.message || 'Import JSON nije uspeo');
    }
  }
}
