import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrchestrationActionLog } from '../entities/orchestration-action-log.entity';
import { ExceptionsService } from '../exceptions/exceptions.service';
import { ReceivingService } from '../receiving/receiving.service';
import { WorkforceService } from '../workforce/workforce.service';
import { StockService } from '../stock/stock.service';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingService } from '../shipping/shipping.service';
import { SlaService } from '../sla/sla.service';

// SLA Matrix (hardcoded config)
export const SLA_MATRIX: Record<string, number> = {
  RECEIVING_DELAY: 30,
  CAPACITY_OVERLOAD: 10,
  LATE_SHIPMENT: 30,
  WORKER_GAP: 5,
  CYCLE_COUNT_DISCREPANCY: 60,
  PUTAWAY_BLOCKED: 15,
};

@Injectable()
export class OrchestrationService {
  constructor(
    @InjectRepository(OrchestrationActionLog)
    private actionLogRepo: Repository<OrchestrationActionLog>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Inventory)
    private inventoryRepo: Repository<Inventory>,
    @InjectRepository(ShippingOrder)
    private shippingRepo: Repository<ShippingOrder>,
    private exceptionsService: ExceptionsService,
    private receivingService: ReceivingService,
    private workforceService: WorkforceService,
    private stockService: StockService,
    private shippingService: ShippingService,
    @Inject(forwardRef(() => SlaService)) private slaService: SlaService,
  ) {}

  async getRecommendations() {
    const exceptions = await this.exceptionsService.getActiveExceptions();
    const workers = await this.workforceService.overview('admin');
    
    const recommendations: any[] = [];

    for (const exc of exceptions) {
      const slaMin = SLA_MATRIX[exc.type] || 30;
      const breachInMin = Math.max(0, slaMin - exc.since_min);
      
      // If already breached, auto-acknowledge
      if (breachInMin === 0) {
        try {
          await this.exceptionsService.acknowledgeException(exc.id, 1, 'admin'); // System user
        } catch {}
      }

      let recommendation: any = null;

      if (exc.type === 'RECEIVING_DELAY' || exc.type === 'WORKER_GAP') {
        // Find best available worker
        const bestWorker = this.findBestWorkerForReassign(exc, workers);
        if (bestWorker) {
          recommendation = {
            exception_id: exc.id,
            type: exc.type,
            severity: exc.severity,
            title: exc.type === 'WORKER_GAP' 
              ? `Preusmjeri zadatak sa ${exc.assigned_worker?.name || 'offline radnika'}`
              : `Preusmjeri prijem ${exc.id.replace('REC-', '')}`,
            proposed_action: 'REASSIGN_WORKER',
            explanation: this.generateReassignExplanation(exc, bestWorker),
            target_user: {
              id: bestWorker.user_id,
              name: bestWorker.full_name || bestWorker.username,
              shift: bestWorker.shift_type || 'N/A',
              online: bestWorker.online_status === 'ONLINE',
              current_load: {
                receivings: bestWorker.open_tasks_count || 0,
                shipments: bestWorker.open_shipping_orders || 0,
                cycle_counts: bestWorker.open_cycle_counts || 0,
              },
            },
            cta_label: `Dodeli ${bestWorker.full_name || bestWorker.username}`,
            cta_api: {
              method: 'PATCH',
              url: `/exceptions/${exc.id}/reassign`,
              body: { target_user_id: bestWorker.user_id },
            },
            sla_state: {
              age_min: exc.since_min,
              sla_min: slaMin,
              breach_in_min: breachInMin,
            },
          };
        }
      } else if (exc.type === 'CAPACITY_OVERLOAD') {
        // Find alternative location
        const altLocation = await this.findAlternativeLocation(exc);
        if (altLocation) {
          recommendation = {
            exception_id: exc.id,
            type: exc.type,
            severity: exc.severity,
            title: `Premesti paletu sa ${exc.location_code}`,
            proposed_action: 'RELOCATE_STOCK',
            explanation: this.generateRelocateExplanation(exc, altLocation),
            target_location: {
              code: altLocation.code,
              fill_ratio: altLocation.fillRatio,
              zone: altLocation.zone || 'N/A',
              distance_hint: '2 prolaza dalje',
            },
            cta_label: 'Kreiraj nalog za premeštaj',
            cta_api: {
              method: 'POST',
              url: '/putaway/move-task',
              body: {
                from_location: exc.location_code,
                to_location: altLocation.code,
                sku: 'AL-PALICE-4.5', // TODO: get from exception details
                qty: 1,
                reason: 'CAPACITY_OVERLOAD',
              },
            },
            sla_state: {
              age_min: exc.since_min,
              sla_min: slaMin,
              breach_in_min: breachInMin,
            },
          };
        }
      } else if (exc.type === 'LATE_SHIPMENT') {
        // Find best worker for shipping
        const bestWorker = this.findBestWorkerForShipping(exc, workers);
        if (bestWorker) {
          recommendation = {
            exception_id: exc.id,
            type: exc.type,
            severity: exc.severity,
            title: `Prioritizuj otpremu ${exc.id.replace('SHIP-', '')}`,
            proposed_action: 'PRIORITIZE_PICK',
            explanation: this.generateShippingExplanation(exc, bestWorker),
            target_user: {
              id: bestWorker.user_id,
              name: bestWorker.full_name || bestWorker.username,
              shift: bestWorker.shift_type || 'N/A',
              online: bestWorker.online_status === 'ONLINE',
              current_load: {
                receivings: bestWorker.open_tasks_count || 0,
                shipments: bestWorker.open_shipping_orders || 0,
                cycle_counts: bestWorker.open_cycle_counts || 0,
              },
            },
            cta_label: `Prioritizuj isporuku i dodeli ${bestWorker.full_name || bestWorker.username}`,
            cta_api: {
              method: 'PATCH',
              url: `/exceptions/${exc.id}/reassign`,
              body: { target_user_id: bestWorker.user_id },
            },
            sla_state: {
              age_min: exc.since_min,
              sla_min: slaMin,
              breach_in_min: breachInMin,
            },
          };
        }
      }

      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Deduplicate: keep only highest severity per exception_id
    const deduplicated = new Map<string, any>();
    for (const rec of recommendations) {
      const existing = deduplicated.get(rec.exception_id);
      if (!existing || this.severityPriority(rec.severity) > this.severityPriority(existing.severity)) {
        deduplicated.set(rec.exception_id, rec);
      }
    }

    return Array.from(deduplicated.values());
  }

  private findBestWorkerForReassign(exception: any, workers: any[]) {
    // Filter online workers
    const onlineWorkers = workers.filter(w => w.online_status === 'ONLINE');
    if (onlineWorkers.length === 0) return null;

    // Exclude current assigned worker if offline
    const available = onlineWorkers.filter(w => 
      !exception.assigned_worker || w.user_id !== exception.assigned_worker.id
    );

    if (available.length === 0) return null;

    // Score workers: lower load = better
    const scored = available.map(w => ({
      worker: w,
      score: (w.open_tasks_count || 0) * 2 + (w.open_shipping_orders || 0) * 1.5,
    }));

    scored.sort((a, b) => a.score - b.score);
    return scored[0].worker;
  }

  private findBestWorkerForShipping(exception: any, workers: any[]) {
    const onlineWorkers = workers.filter(w => w.online_status === 'ONLINE');
    if (onlineWorkers.length === 0) return null;

    // Prefer workers with no active receivings (shipping focused)
    const shippingFocused = onlineWorkers
      .filter(w => (w.open_tasks_count || 0) === 0)
      .sort((a, b) => (a.open_shipping_orders || 0) - (b.open_shipping_orders || 0));

    return shippingFocused[0] || onlineWorkers[0];
  }

  private async findAlternativeLocation(exception: any) {
    const currentLocation = await this.locationRepo.findOne({
      where: { code: exception.location_code } as any,
    });
    if (!currentLocation) return null;

    // Find locations in other zones with free capacity
    const allLocations = await this.locationRepo.find();
    const currentZone = (currentLocation as any).rack?.aisle?.zone?.name;

    for (const loc of allLocations) {
      if (loc.code === exception.location_code) continue;
      
      const zone = (loc as any).rack?.aisle?.zone?.name;
      if (zone === currentZone) continue; // Prefer different zone

      const inv = await this.inventoryRepo.find({ where: { location_id: loc.id } });
      const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const cap = loc.capacity || 0;
      const fillRatio = cap > 0 ? used / cap : 0;

      // Find location with 40-60% fill (good balance)
      if (fillRatio >= 0.4 && fillRatio <= 0.6 && cap > 0) {
        return {
          code: loc.code,
          fillRatio,
          zone,
        };
      }
    }

    // Fallback: any location with <80% fill
    for (const loc of allLocations) {
      if (loc.code === exception.location_code) continue;
      const inv = await this.inventoryRepo.find({ where: { location_id: loc.id } });
      const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const cap = loc.capacity || 0;
      const fillRatio = cap > 0 ? used / cap : 0;
      if (fillRatio < 0.8 && cap > 0) {
        return {
          code: loc.code,
          fillRatio,
          zone: (loc as any).rack?.aisle?.zone?.name || 'N/A',
        };
      }
    }

    return null;
  }

  private generateReassignExplanation(exception: any, worker: any): string {
    const currentWorker = exception.assigned_worker;
    if (exception.type === 'WORKER_GAP' && currentWorker && !currentWorker.online) {
      return `${currentWorker.name} je offline ${exception.since_min} min. ${worker.full_name || worker.username} (${worker.shift_type || 'N/A'}) je online i ima ${worker.open_tasks_count || 0} aktivnih zadataka. Predlažem preusmeravanje.`;
    }
    return `${worker.full_name || worker.username} (${worker.shift_type || 'N/A'}) je online i ima ${worker.open_tasks_count || 0} aktivnih zadataka. Optimalan za preuzimanje ovog prijema.`;
  }

  private generateRelocateExplanation(exception: any, target: any): string {
    return `Lokacija ${exception.location_code} je preko kapaciteta i blokira put-away. Lokacija ${target.code} u zoni ${target.zone} ima ${Math.round(target.fillRatio * 100)}% popunjenosti. Predlažem premeštaj.`;
  }

  private generateShippingExplanation(exception: any, worker: any): string {
    return `Otprema ${exception.id.replace('SHIP-', '')} kasni ${exception.since_min} min. ${worker.full_name || worker.username} je online i bez aktivnih prijema. Predlažem prioritizaciju i dodelu.`;
  }

  private severityPriority(severity: string): number {
    const order: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      info: 1,
    };
    return order[severity] || 0;
  }

  async executeAction(
    exceptionId: string,
    actionType: string,
    payload: any,
    executedByUserId: number,
  ) {
    // Log the action
    const log = this.actionLogRepo.create({
      exception_id: exceptionId,
      action_type: actionType,
      executed_by_user_id: executedByUserId,
      payload_json: JSON.stringify(payload),
    });
    await this.actionLogRepo.save(log);

    // Get exception to record in SLA
    const exceptions = await this.exceptionsService.getActiveExceptions();
    const exception = exceptions.find(e => e.id === exceptionId);

    // Execute based on action type
    if (actionType === 'REASSIGN_WORKER') {
      await this.exceptionsService.reassignException(exceptionId, payload.target_user_id);
    } else if (actionType === 'RELOCATE_STOCK') {
      // Create putaway move task (this would need to be implemented)
      // For now, just log it
      console.log('RELOCATE_STOCK action:', payload);
    } else if (actionType === 'PRIORITIZE_PICK') {
      await this.exceptionsService.reassignException(exceptionId, payload.target_user_id || payload.assign_user_id);
    }

    // Record SLA resolution
    if (exception) {
      await this.slaService.resolveEvent(
        exceptionId,
        executedByUserId,
        actionType,
        new Date(),
      );
    }

    return { ok: true, logged: true };
  }
}

