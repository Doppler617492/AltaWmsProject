import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationLabel, LabelStatus, BarcodeType } from '../entities/location-label.entity';
import { PrintJob, JobType, JobStatus } from '../entities/print-job.entity';
import { Location } from '../entities/location.entity';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(LocationLabel)
    private labelRepo: Repository<LocationLabel>,
    @InjectRepository(PrintJob)
    private printJobRepo: Repository<PrintJob>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
  ) {}

  async getLocations(params: {
    status?: LabelStatus;
    zone?: string;
    unlabeledOnly?: boolean;
  }) {
    const query = this.labelRepo.createQueryBuilder('label');

    if (params.status) {
      query.where('label.status = :status', { status: params.status });
    }

    if (params.zone) {
      query.andWhere('label.zone_code = :zone', { zone: params.zone });
    }

    if (params.unlabeledOnly) {
      query.andWhere('label.status IN (:...statuses)', { statuses: [LabelStatus.NEW, LabelStatus.PRINTED] });
    }

    return query.orderBy('label.location_code', 'ASC').getMany();
  }

  async getLocationByCode(locationCode: string) {
    const label = await this.labelRepo.findOne({
      where: { location_code: locationCode },
      relations: ['last_printed_by', 'placed_by'],
    });

    if (!label) {
      // Try to find location in warehouse
      const location = await this.locationRepo.findOne({
        where: { code: locationCode } as any,
        relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
      });

      if (location) {
        // Create label entry if location exists but no label
        const newLabel = this.labelRepo.create({
          location_code: locationCode,
          zone_code: (location as any).rack?.aisle?.zone?.name || null,
          rack_id: (location as any).rack?.name || null,
          aisle_id: (location as any).rack?.aisle?.code || null,
          level: location.row ? String(location.row) : null,
          status: LabelStatus.NEW,
        });
        await this.labelRepo.save(newLabel);
        return newLabel;
      }

      throw new NotFoundException(`Location ${locationCode} not found`);
    }

    return label;
  }

  async printLabels(locationCodes: string[], barcodeType: BarcodeType, layout: string, userId: number) {
    const labels = [];

    for (const code of locationCodes) {
      let label = await this.labelRepo.findOne({ where: { location_code: code } });

      if (!label) {
        const location = await this.locationRepo.findOne({
          where: { code: code } as any,
          relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
        });

        if (!location) {
          continue; // Skip invalid locations
        }

        label = this.labelRepo.create({
          location_code: code,
          zone_code: (location as any).rack?.aisle?.zone?.name || null,
          rack_id: (location as any).rack?.name || null,
          aisle_id: (location as any).rack?.aisle?.code || null,
          level: location.row ? String(location.row) : null,
          barcode_type: barcodeType,
          status: LabelStatus.NEW,
        });
        await this.labelRepo.save(label);
      }

      // Update label to PRINTED
      label.status = LabelStatus.PRINTED;
      label.last_printed_at = new Date();
      label.last_printed_by_user_id = userId;
      await this.labelRepo.save(label);

      labels.push(label);
    }

    // Create print job
    const printJob = this.printJobRepo.create({
      job_type: JobType.LOCATION_LABELS,
      requested_by_user_id: userId,
      payload_json: {
        locations: locationCodes,
        barcodeType,
        layout,
      },
      status: JobStatus.DONE,
    });
    await this.printJobRepo.save(printJob);

    // Generate PDF (placeholder - real implementation would use PDF library)
    const pdfBase64 = this.generatePdfPlaceholder(labels, barcodeType, layout);

    return {
      jobId: printJob.id,
      pdf: pdfBase64,
    };
  }

  async markAsPlaced(locationCode: string, userId: number) {
    const label = await this.labelRepo.findOne({ where: { location_code: locationCode } });

    if (!label) {
      throw new NotFoundException(`Label for location ${locationCode} not found`);
    }

    label.status = LabelStatus.PLACED;
    label.placed_by_user_id = userId;
    label.placed_at = new Date();
    await this.labelRepo.save(label);

    return label;
  }

  private generatePdfPlaceholder(labels: LocationLabel[], barcodeType: BarcodeType, layout: string): string {
    // Placeholder - in production, use a PDF library like pdfkit or pdfmake
    // For now, return base64 encoded placeholder text
    const content = labels.map(l => `${l.location_code} (${l.barcode_type})`).join('\n');
    return Buffer.from(`TODO_PDF_GENERATION\n${content}`).toString('base64');
  }

  // Helper method to get location details for PWA
  async getLocationDetails(locationCode: string) {
    const label = await this.getLocationByCode(locationCode);
    const location = await this.locationRepo.findOne({
      where: { code: locationCode } as any,
      relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
    });

    const zone = (location as any)?.rack?.aisle?.zone?.name || label.zone_code || 'N/A';
    const aisle = (location as any)?.rack?.aisle?.code || label.aisle_id || 'N/A';
    const rack = (location as any)?.rack?.name || label.rack_id || 'N/A';
    const level = location?.row ? String(location.row) : label.level || 'N/A';

    const humanText = `${zone !== 'N/A' ? `Zona ${zone}` : ''}${aisle !== 'N/A' ? ` / Prolaz ${aisle}` : ''}${rack !== 'N/A' ? ` / Regal ${rack}` : ''}${level !== 'N/A' ? ` / Nivo ${level}` : ''}`.trim();

    return {
      location_code: label.location_code,
      zone_code: zone,
      barcode_type: label.barcode_type,
      status: label.status,
      human_text: humanText || locationCode,
      recommended_use: location?.capacity ? (location.capacity > 1000 ? 'TEŠKA ROBA / VISOKI RIZIK' : 'STANDARDNA ROBA') : null,
      safety: location?.row && ['4', '5'].includes(String(location.row)) ? ['PPE RUKAVICE', '2 OSOBE ZA DIZANJE'] : [],
    };
  }

  async deleteLocationLabel(locationCode: string) {
    const label = await this.labelRepo.findOne({ where: { location_code: locationCode } });
    if (!label) return { ok: true };
    if (label.status === LabelStatus.PLACED) {
      throw new Error('Nije moguće obrisati etiketu koja je označena kao postavljena');
    }
    await this.labelRepo.delete({ id: label.id });
    return { ok: true };
  }
}
