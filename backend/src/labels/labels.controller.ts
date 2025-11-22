import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, ForbiddenException, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LabelsService } from './labels.service';
import { LabelStatus, BarcodeType } from '../entities/location-label.entity';

@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get('locations')
  async getLocations(
    @Query('status') status?: LabelStatus,
    @Query('zone') zone?: string,
    @Query('unlabeledOnly') unlabeledOnly?: string,
    @Req() req?: any,
  ) {
    const allowed = ['admin', 'menadzer', 'sef_magacina'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    return this.labelsService.getLocations({
      status,
      zone,
      unlabeledOnly: unlabeledOnly === 'true',
    });
  }

  @Post('locations/print')
  async printLabels(
    @Body('locations') locations: string[],
    @Body('barcodeType') barcodeType: BarcodeType,
    @Body('layout') layout: string,
    @Req() req: any,
  ) {
    const allowed = ['admin', 'sef_magacina'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za štampu');
    }

    return this.labelsService.printLabels(locations, barcodeType, layout, req.user.id);
  }

  @Patch('location/:locationCode/placed')
  async markAsPlaced(@Param('locationCode') locationCode: string, @Req() req: any) {
    // Both admin and magacioner can mark as placed (magacioner does it through PWA)
    return this.labelsService.markAsPlaced(locationCode, req.user.id);
  }

  @Get('location/:locationCode')
  async getLocation(@Param('locationCode') locationCode: string, @Req() req: any) {
    // All authenticated users can check location label status
    return this.labelsService.getLocationDetails(locationCode);
  }

  @Delete('location/:locationCode')
  async deleteLocationLabel(@Param('locationCode') locationCode: string, @Req() req: any) {
    const allowed = ['admin','sef_magacina'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za brisanje etikete');
    }
    return this.labelsService.deleteLocationLabel(locationCode);
  }
}
