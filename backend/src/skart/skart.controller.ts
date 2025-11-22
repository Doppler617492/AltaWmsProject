import { BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkartService } from './skart.service';
import { CreateSkartDto } from './dto/create-skart.dto';
import { ReceiveSkartDto } from './dto/receive-skart.dto';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { promises as fs } from 'fs';
import type { Express } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('skart')
export class SkartController {
  constructor(private readonly skartService: SkartService) {}

  @Get()
  async listDocuments(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('status') status: string,
    @Query('assignedToUserId') assignedToUserId: string,
    @Req() req: any,
  ) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'sef', 'magacioner', 'store', 'prodavnica', 'sef_prodavnice']);
    return this.skartService.listDocuments({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status: status as any,
      assignedToUserId: assignedToUserId ? Number(assignedToUserId) : undefined,
    }, { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null });
  }

  @Post()
  async createDocument(@Body() dto: CreateSkartDto, @Req() req: any) {
    ensureRole(req.user?.role, ['admin', 'store', 'prodavnica', 'menadzer', 'sef', 'sef_prodavnice']);
    return this.skartService.createDocument(
      { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null },
      dto,
    );
  }

  @Get(':uid')
  async getDocument(@Param('uid') uid: string, @Req() req: any) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'sef', 'magacioner', 'store', 'prodavnica', 'sef_prodavnice']);
    return this.skartService.getDocumentByUid(uid, { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null });
  }

  @Patch(':uid/receive')
  async receiveDocument(@Param('uid') uid: string, @Body() dto: ReceiveSkartDto, @Req() req: any) {
    ensureRole(req.user?.role, ['admin', 'magacioner', 'warehouse', 'sef', 'menadzer']);
    return this.skartService.receiveDocument(
      { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null },
      uid,
      dto,
    );
  }

  @Post(':uid/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = join(process.cwd(), 'uploads', 'skart-temp');
          fs.mkdir(dest, { recursive: true })
            .then(() => cb(null, dest))
            .catch((err) => cb(err, dest));
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${getExtension(file.originalname)}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async uploadPhoto(
    @Param('uid') uid: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    ensureRole(req.user?.role, ['admin', 'store', 'prodavnica', 'magacioner', 'warehouse', 'sef', 'menadzer']);
    if (!file) {
      throw new BadRequestException('Nije otpremljena slika.');
    }
    const webPath = await this.movePhotoToDocumentFolder(uid, file);
    return this.skartService.addPhoto(
      { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null },
      uid,
      webPath,
    );
  }

  @Get('reports/summary')
  async summary(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('storeId') storeId: string,
    @Query('window') window: string,
    @Req() req: any,
  ) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'manager', 'sef', 'magacioner', 'store', 'prodavnica', 'sef_prodavnice']);
    return this.skartService.summaryReport({
      from,
      to,
      storeId: storeId ? parseInt(storeId, 10) : undefined,
      window,
    }, { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null });
  }

  @Get('reports/anomalies')
  async anomalies(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('window') window: string,
    @Req() req: any,
  ) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'manager', 'sef', 'magacioner', 'store', 'prodavnica', 'sef_prodavnice']);
    return this.skartService.anomaliesReport({ from, to, window }, { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null });
  }

  @Get('qr/:uid/pdf')
  async downloadPdf(@Param('uid') uid: string, @Res() res: Response, @Req() req: any) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'manager', 'sef', 'magacioner', 'store', 'prodavnica', 'sef_prodavnice']);
    const buffer = await this.skartService.generateQrPdf(uid, { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SKART-${uid}.pdf"`);
    res.send(buffer);
  }

  @Patch(':uid/assign')
  async assignDocument(@Param('uid') uid: string, @Body() body: { assignedToUserId?: number | null }, @Req() req: any) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'sef', 'sef_magacina']);
    return this.skartService.assignDocument(
      { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null },
      uid,
      body.assignedToUserId !== undefined ? body.assignedToUserId : null,
    );
  }

  @Delete(':uid')
  async deleteDocument(@Param('uid') uid: string, @Req() req: any) {
    ensureRole(req.user?.role, ['admin', 'menadzer', 'sef', 'sef_magacina']);
    await this.skartService.deleteDocument(
      { id: req.user?.id, role: req.user?.role, name: req.user?.name, storeId: req.user?.store_id ?? null },
      uid,
    );
    return { success: true, message: 'SKART dokument je obrisan.' };
  }

  private async movePhotoToDocumentFolder(uid: string, file: any) {
    const targetDir = join(process.cwd(), 'uploads', 'skart', uid);
    await fs.mkdir(targetDir, { recursive: true });
    const destination = join(targetDir, file.filename);
    await fs.rename(file.path, destination);
    return `/uploads/skart/${uid}/${file.filename}`;
  }
}

function getExtension(name: string) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.substring(idx) : '.jpg';
}

function ensureRole(role: string, allowed: string[]) {
  const normalized = (role || '').toLowerCase();
  const ok = allowed.some((r) => r.toLowerCase() === normalized);
  if (!ok) {
    throw new ForbiddenException('Nemate dozvolu za ovu funkciju.');
  }
}



