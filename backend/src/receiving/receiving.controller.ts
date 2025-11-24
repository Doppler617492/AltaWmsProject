import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query, Req, UseInterceptors, UploadedFile, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { join } from 'path';
import { ReceivingService } from './receiving.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReceivingRolesGuard } from '../auth/roles.guard';
import { ItemStatus } from '../entities/receiving-item.entity';

@UseGuards(JwtAuthGuard, ReceivingRolesGuard)
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Post('documents')
  async createDocument(
    @Body() data: {
      document_number: string;
      supplier_id: number;
      pantheon_invoice_number: string;
      assigned_to_user_id?: number;
      notes?: string;
      document_date?: string | Date;
      store_name?: string;
      responsible_person?: string;
      invoice_number?: string;
    },
    @Req() req: any,
  ) {
    const assigned = data.assigned_to_user_id !== undefined && data.assigned_to_user_id !== null
      ? Number(data.assigned_to_user_id)
      : undefined;
    return this.receivingService.createDocument({
      document_number: data.document_number,
      supplier_id: data.supplier_id,
      pantheon_invoice_number: data.pantheon_invoice_number,
      notes: data.notes,
      assigned_to: assigned,
      document_date: data.document_date,
      store_name: data.store_name,
      responsible_person: data.responsible_person,
      invoice_number: data.invoice_number,
      created_by: req.user?.id || null,
      // Actor context will be read from req in service via separate methods if needed
    });
  }

  @Get('documents')
  async getAllDocuments(
    @Query('status') status: string,
    @Req() req: any
  ) {
    return this.receivingService.getAllDocuments(req.user.role, req.user.id);
  }

  // Active receivings for dock supervisor view
  // Returns IN_PROGRESS and ON_HOLD documents with aggregates
  @Get('active')
  async getActive(@Req() req: any) {
    // RBAC handled by ReceivingRolesGuard
    return this.receivingService.getActiveReceivings();
  }

  // Trailing-slash alias to avoid 404/307 quirks
  @Get('active/')
  async getActiveSlash(@Req() req: any) {
    return this.receivingService.getActiveReceivings();
  }

  // Dashboard aggregation for dock supervisor (cached 5s)
  @Get('active/dashboard')
  async getDashboard(@Req() req: any) {
    // RBAC via guard ensures admin/menadzer/sef/magacioner allowed; enforce supervisor here
    const role = req.user?.role?.toLowerCase();
    if (!['admin','menadzer','sef','sef_magacina'].includes(role)) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Pristup ograničen na admin/menadžer/šef.');
    }
    return this.receivingService.getDashboardSnapshot();
  }

  @Get('documents/:id')
  async getDocumentById(@Param('id') id: string) {
    return this.receivingService.getDocumentById(parseInt(id));
  }

  @Get('items/:id/recommend-location')
  async recommendLocation(@Param('id') id: string, @Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'magacioner'];
    if (!allowed.includes(req.user.role?.toLowerCase())) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.receivingService.recommendLocation(parseInt(id), req.user.id, req.user.role);
  }

  @Post('items')
  async addItem(
    @Body() data: {
      document_id: number;
      item_id: number;
      expected_quantity: number;
      barcode?: string;
    }
  ) {
    return this.receivingService.addItemToDocument(
      data.document_id,
      data.item_id,
      data.expected_quantity,
      data.barcode
    );
  }

  @Patch('items/:id')
  async updateItem(
    @Param('id') id: string,
    @Body() data: {
      received_quantity?: number;
      status?: ItemStatus;
      location_id?: number;
      pallet_id?: string;
      condition_notes?: string;
    }
  ) {
    return this.receivingService.updateItem(parseInt(id), data);
  }

  @Delete('items/:id')
  async deleteItem(@Param('id') id: string, @Req() req: any) {
    return this.receivingService.deleteItem({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }

  // Optional helper: fetch a single receiving item (used by some UIs)
  @Get('items/:id')
  async getItem(@Param('id') id: string) {
    return this.receivingService.getItemById(parseInt(id));
  }

  @Post('photos')
  async uploadPhoto(
    @Body() data: {
      document_id: number;
      photo_url: string;
      user_id: number;
      caption?: string;
    }
  ) {
    return this.receivingService.uploadPhoto(
      data.document_id,
      data.photo_url,
      data.user_id,
      data.caption
    );
  }

  @Patch('documents/:id/start')
  async startDocument(
    @Param('id') id: string,
    @Body() data: { assigned_to_user_id?: number },
    @Req() req: any,
  ) {
    return this.receivingService.startDocument(parseInt(id), data?.assigned_to_user_id, req.user);
  }

  // Assignee list for reassign modal
  @Get('assignees')
  async getAssignees() {
    return this.receivingService.getAssignableWorkers();
  }

  @Patch('documents/:id/complete')
  async completeDocument(@Param('id') id: string, @Req() req: any) {
    return this.receivingService.completeDocument(parseInt(id), req.user);
  }

  // Alias to support POST as used by some clients
  @Post('documents/:id/complete')
  async completeDocumentPost(@Param('id') id: string) {
    return this.receivingService.completeDocument(parseInt(id));
  }

  // Magacioner: moji aktivni prijemi (i admini sa ?userId)
  @Get('my-active')
  async getMyActive(@Req() req: any, @Query('userId') userId?: string) {
    const actor = req.user;
    return this.receivingService.getMyActive(actor, userId ? parseInt(userId) : undefined);
  }

  // Put document on hold
  @Patch('documents/:id/hold')
  async holdDocument(@Param('id') id: string, @Body('reason') reason?: string, @Req() req?: any) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role } : undefined;
    return this.receivingService.setHold(parseInt(id), true, reason, actor);
  }

  // Release document from hold
  @Patch('documents/:id/release')
  async releaseDocument(@Param('id') id: string, @Req() req?: any) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role } : undefined;
    return this.receivingService.setHold(parseInt(id), false, undefined, actor);
  }

  @Get('stats')
  async getStats() {
    return this.receivingService.getStats();
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string, @Req() req?: any) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role } : undefined;
    return this.receivingService.deleteDocument(parseInt(id), actor);
  }

  @Post('documents/bulk-delete')
  async bulkDeleteDocuments(
    @Body() body: { documentIds: number[] },
    @Req() req: any,
  ) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role } : undefined;
    return this.receivingService.deleteDocumentsBulk(body.documentIds || [], actor);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async importFromPantheon(
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    try {
      if (!file || (!file.buffer && !file.path)) {
        throw new BadRequestException('Excel fajl nije priložen');
      }
      const previewOnly = String(body?.preview ?? req.query?.preview ?? '').toLowerCase() === 'true';
      if (previewOnly) {
        return await this.receivingService.previewPantheon(file);
      }
      const notes = body.notes || '';
      const assigned = body.assigned_to_user_id ? parseInt(body.assigned_to_user_id) : undefined;
      return await this.receivingService.importFromPantheon(file, notes, assigned, req.user?.id || null);
    } catch (e: any) {
      console.error('Receiving import error:', e?.message || e);
      throw new BadRequestException(e?.message || 'Import nije uspeo');
    }
  }

  @Post('import-json')
  async importFromJson(@Body() body: any, @Req() req: any) {
    return this.receivingService.importFromJson(body, req.user?.id || 0);
  }

  // Alias per FAZA 3.1: /receiving/documents/:id/photos
  @Post('documents/:id/photos')
  async uploadPhotoForDocument(
    @Param('id') id: string,
    @Body() data: { photo_url: string; user_id: number; caption?: string; item_id?: number; note?: string },
    @Req() req: any,
  ) {
    await this.receivingService.ensureCanUpload(req.user, parseInt(id));
    return this.receivingService.uploadPhoto(
      parseInt(id),
      data.photo_url,
      data.user_id || req.user?.id,
      data.caption,
      data.item_id
    );
  }

  // File upload for document photo evidence (multipart/form-data, field name: file)
  @Post('documents/:id/photos/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhotoFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('caption') caption: string,
    @Body('item_id') itemId: string,
    @Req() req: any,
  ) {
    await this.receivingService.ensureCanUpload(req.user, parseInt(id));
    if (!file) {
      throw new Error('Fajl nije priložen');
    }
    // Validate mime
    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      const err: any = new Error('Nedozvoljen format. Dozvoljeno: JPG, PNG.');
      (err.status = 415);
      throw err;
    }

    // Move into /uploads/receiving/<document_number>/unique-name
    const moved = await this.receivingService.moveUploadedPhotoToDocumentDir(parseInt(id), file);
    const photoUrl = moved.webPath; // '/uploads/receiving/<docNo>/<filename>'
    const userId = req.user?.id || 0;
    return this.receivingService.uploadPhoto(parseInt(id), photoUrl, userId, caption, itemId ? parseInt(itemId) : undefined);
  }

  // List photos for a document (admin/menadzer/sef always; magacioner only if assigned and not completed)
  @Get('documents/:id/photos')
  async listPhotos(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.receivingService.getDocumentPhotos(req.user, parseInt(id));
  }

  // Stats for today (Prijem danas)
  @Get('stats-today')
  async getStatsToday() {
    return this.receivingService.getTodayStats();
  }

  // Reassign only: does not change status (admin/menadzer/sef)
  @Patch('documents/:id/reassign')
  async reassignDocument(
    @Param('id') id: string,
    @Body() data: { assigned_to_user_id: number },
    @Req() req: any,
  ) {
    const role = req.user?.role || '';
    const actorId = req.user?.id;
    return this.receivingService.reassignDocument(parseInt(id), data.assigned_to_user_id, role, actorId);
  }
}
