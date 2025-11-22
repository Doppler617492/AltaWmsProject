import { Injectable, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan, IsNull } from 'typeorm';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { CycleCountTask, CycleCountTaskStatus } from '../cycle-count/cycle-count-task.entity';
import { Inventory } from '../entities/inventory.entity';
import { Location } from '../entities/location.entity';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { ExceptionAckLog } from '../entities/exception-ack-log.entity';
import { ReceivingService } from '../receiving/receiving.service';
import { SlaService } from '../sla/sla.service';
import { WorkforceService } from '../workforce/workforce.service';
import { AssignmentsGateway } from '../workforce/assignments.gateway';

@Injectable()
export class ExceptionsService {
  constructor(
    @InjectRepository(ReceivingDocument) private receivingDocRepo: Repository<ReceivingDocument>,
    @InjectRepository(ReceivingItem) private receivingItemRepo: Repository<ReceivingItem>,
    @InjectRepository(ShippingOrder) private shippingRepo: Repository<ShippingOrder>,
    @InjectRepository(PutawayTask) private putawayRepo: Repository<PutawayTask>,
    @InjectRepository(CycleCountTask) private cycleCountRepo: Repository<CycleCountTask>,
    @InjectRepository(Inventory) private inventoryRepo: Repository<Inventory>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserShift) private shiftRepo: Repository<UserShift>,
    @InjectRepository(ExceptionAckLog) private ackLogRepo: Repository<ExceptionAckLog>,
    private receivingService: ReceivingService,
    @Inject(forwardRef(() => SlaService)) private slaService: SlaService,
    @Inject(forwardRef(() => WorkforceService)) private workforceService: WorkforceService,
    @Optional() private assignmentsGateway?: AssignmentsGateway,
  ) {}

  async getActiveExceptions() {
    const now = Date.now();
    const twentyMinutesAgo = new Date(now - 20 * 60000);
    const twoMinutesAgo = new Date(now - 2 * 60000);
    const thirtyMinutesAgo = new Date(now - 30 * 60000);
    
    const exceptions: any[] = [];

    // 1. RECEIVING_DELAY - prijemi koji kasne ili su on_hold
    const delayedReceivings = await this.receivingDocRepo.find({
      where: [
        { status: ReceivingStatus.ON_HOLD } as any,
        { status: ReceivingStatus.IN_PROGRESS, started_at: LessThan(twentyMinutesAgo) } as any,
      ],
      relations: ['assignedUser', 'items'],
    });

    for (const doc of delayedReceivings) {
      const items = await this.receivingItemRepo.find({ where: { receiving_document_id: doc.id } });
      const missingLocations = items.filter(it => !it.location_id && Number(it.received_quantity || 0) > 0);
      const incompleteItems = items.filter(it => Number(it.received_quantity || 0) < Number(it.expected_quantity || 0));
      
      const details = [];
      if (doc.status === ReceivingStatus.ON_HOLD) {
        details.push('Na čekanju (ON HOLD)');
      }
      if (missingLocations.length > 0) {
        details.push(`Nedostaje lokacija za ${missingLocations.length} stavke`);
      }
      if (incompleteItems.length > 0 && doc.status !== ReceivingStatus.ON_HOLD) {
        details.push(`${incompleteItems.length} stavki nedovršeno`);
      }

      const sinceMin = doc.started_at
        ? Math.floor((now - new Date(doc.started_at).getTime()) / 60000)
        : Math.floor((now - new Date(doc.created_at).getTime()) / 60000);

      const severity = doc.status === ReceivingStatus.ON_HOLD ? 'high' :
                       sinceMin > 60 ? 'critical' :
                       sinceMin > 30 ? 'high' : 'medium';

      const exceptionId = `REC-${doc.id}`;
      exceptions.push({
        id: exceptionId,
        type: 'RECEIVING_DELAY',
        severity,
        since_min: sinceMin,
        status: doc.status === ReceivingStatus.ON_HOLD ? 'ON_HOLD' : 'IN_PROGRESS',
        title: `Prijem ${doc.document_number} ${doc.status === ReceivingStatus.ON_HOLD ? 'blokiran' : 'kasni'}`,
        details: details.join(', ') || 'Prijem u toku',
        assigned_worker: doc.assignedUser ? {
          id: doc.assignedUser.id,
          name: doc.assignedUser.full_name || doc.assignedUser.name,
          shift: doc.assignedUser.shift || 'N/A',
          online: doc.assignedUser.last_activity
            ? new Date(doc.assignedUser.last_activity).getTime() > twoMinutesAgo.getTime()
            : false,
        } : null,
        actions: doc.status === ReceivingStatus.ON_HOLD
          ? ['ASSIGN_OTHER', 'UNHOLD', 'OPEN_DOCUMENT']
          : missingLocations.length > 0
          ? ['ASSIGN_OTHER', 'OPEN_DOCUMENT']
          : ['ASSIGN_OTHER', 'OPEN_DOCUMENT'],
        document_id: doc.id,
      });

      // Record in SLA (async, don't block)
      this.slaService.recordEvent(
        exceptionId,
        'RECEIVING_DELAY',
        severity,
        doc.started_at || doc.created_at,
        {
          location_code: null,
          zone: null,
          item_sku: null,
          worker: doc.assignedUser ? (doc.assignedUser.full_name || doc.assignedUser.name) : null,
        },
      ).catch(() => {});
    }

    // 2. CAPACITY_OVERLOAD - lokacije preko kapaciteta
    const locations = await this.locationRepo.find();
    for (const loc of locations) {
      const inv = await this.inventoryRepo.find({ where: { location_id: loc.id } });
      const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const cap = loc.capacity || 0;
      if (cap > 0 && used / cap > 1.0) {
        const fillRatio = used / cap;
        exceptions.push({
          id: `LOC-${loc.code}`,
          type: 'CAPACITY_OVERLOAD',
          severity: fillRatio > 1.15 ? 'critical' : 'high',
          since_min: 0, // TODO: track when it started
          status: 'BLOCKING_PUTAWAY',
          title: `Lokacija ${loc.code} je na ${Math.round(fillRatio * 100)}% punjenja`,
          details: `Kapacitet: ${cap}, Iskorišćeno: ${Math.round(used)}`,
          zone: (loc as any).rack?.aisle?.zone?.name || null,
          actions: ['RELOCATE_STOCK', 'OPEN_LOCATION'],
          location_code: loc.code,
          location_id: loc.id,
        });
      }
    }

    // 3. PUTAWAY_BLOCKED - nema slobodnih lokacija za paletu
    const blockedPutaways = await this.putawayRepo.find({
      where: { status: 'BLOCKED' } as any,
    });
    for (const task of blockedPutaways) {
      exceptions.push({
        id: `PUTAWAY-${task.id}`,
        type: 'PUTAWAY_BLOCKED',
        severity: 'medium',
        since_min: Math.floor((now - new Date(task.created_at).getTime()) / 60000),
        status: 'BLOCKED',
        title: `Put-away zadatak ${task.pallet_id} blokiran`,
        details: task.notes || 'Nema slobodnih lokacija',
        assigned_worker: task.assigned_user ? {
          id: task.assigned_user.id,
          name: (task.assigned_user as any).full_name || task.assigned_user.username,
          shift: task.assigned_user.shift || 'N/A',
          online: task.assigned_user.last_activity
            ? new Date(task.assigned_user.last_activity).getTime() > twoMinutesAgo.getTime()
            : false,
        } : null,
        actions: ['UNBLOCK_PUTAWAY', 'ASSIGN_OTHER'],
        putaway_task_id: task.id,
      });
    }

    // 4. LATE_SHIPMENT - nalog za isporuku kasni
    const staleShipments = await this.shippingRepo.find({
      where: [
        { status: 'PICKING', started_at: LessThan(twentyMinutesAgo) } as any,
        { status: 'STAGED', staged_at: LessThan(twentyMinutesAgo) } as any,
      ],
      relations: ['assigned_user', 'lines'],
    });

    for (const ship of staleShipments) {
      const sinceMin = ship.started_at
        ? Math.floor((now - new Date(ship.started_at).getTime()) / 60000)
        : ship.staged_at
        ? Math.floor((now - new Date(ship.staged_at).getTime()) / 60000)
        : 0;

      const unpickedLines = ship.lines?.filter((l: any) => l.status_per_line !== 'PICKED' && l.status_per_line !== 'STAGED' && l.status_per_line !== 'LOADED') || [];
      
      exceptions.push({
        id: `SHIP-${ship.order_number}`,
        type: 'LATE_SHIPMENT',
        severity: sinceMin > 60 ? 'critical' : sinceMin > 40 ? 'high' : 'medium',
        since_min: sinceMin,
        status: ship.status === 'PICKING' ? 'WAITING_PICK' : 'WAITING_LOAD',
        title: `Otpremna ${ship.order_number} kasni`,
        details: `${unpickedLines.length} linija nepokupjene`,
        assigned_worker: ship.assigned_user ? {
          id: ship.assigned_user.id,
          name: (ship.assigned_user as any).full_name || ship.assigned_user.username,
          shift: ship.assigned_user.shift || 'N/A',
          online: ship.assigned_user.last_activity
            ? new Date(ship.assigned_user.last_activity).getTime() > twoMinutesAgo.getTime()
            : false,
        } : null,
        actions: ['REASSIGN_PICK', 'PRIORITIZE', 'OPEN_SHIP_ORDER'],
        shipping_order_id: ship.id,
      });
    }

    // 5. WORKER_GAP - radnik offline a ima zadatak
    const allUsers = await this.userRepo.find();
    for (const user of allUsers) {
      const online = user.last_activity
        ? new Date(user.last_activity).getTime() > twoMinutesAgo.getTime()
        : false;

      if (!online) {
        // Check if user has active receiving
        const activeReceiving = await this.receivingDocRepo.findOne({
          where: { assigned_to: user.id, status: ReceivingStatus.IN_PROGRESS } as any,
        });
        
        // Check if user has active shipping
        const activeShipping = await this.shippingRepo
          .createQueryBuilder('s')
          .leftJoinAndSelect('s.assigned_user', 'u')
          .where('s.assigned_user.id = :userId', { userId: user.id })
          .andWhere("s.status = 'PICKING'")
          .getOne();

        if (activeReceiving) {
          exceptions.push({
            id: `WORKER-${user.id}-REC-${activeReceiving.id}`,
            type: 'WORKER_GAP',
            severity: 'high',
            since_min: Math.floor((now - new Date(user.last_activity || user.updated_at).getTime()) / 60000),
            status: 'OFFLINE_WITH_TASK',
            title: `${user.full_name || user.name} offline sa prijemom`,
            details: `Prijem ${activeReceiving.document_number} dodeljen ali radnik offline`,
            assigned_worker: {
              id: user.id,
              name: user.full_name || user.name,
              shift: user.shift || 'N/A',
              online: false,
            },
            actions: ['REASSIGN_PICK'],
            user_id: user.id,
            document_id: activeReceiving.id,
          });
        }

        if (activeShipping) {
          exceptions.push({
            id: `WORKER-${user.id}-SHIP-${activeShipping.id}`,
            type: 'WORKER_GAP',
            severity: 'high',
            since_min: Math.floor((now - new Date(user.last_activity || user.updated_at).getTime()) / 60000),
            status: 'OFFLINE_WITH_TASK',
            title: `${user.full_name || user.name} offline sa otpremom`,
            details: `Otprema ${activeShipping.order_number} dodeljena ali radnik offline`,
            assigned_worker: {
              id: user.id,
              name: user.full_name || user.name,
              shift: user.shift || 'N/A',
              online: false,
            },
            actions: ['REASSIGN_PICK'],
            user_id: user.id,
            shipping_order_id: activeShipping.id,
          });
        }
      }
    }

    // 6. CYCLE_COUNT_DISCREPANCY - popis otkrio razliku ali nije reconciled
    const completedCounts = await this.cycleCountRepo.find({
      where: { status: CycleCountTaskStatus.COMPLETED, updated_at: LessThan(thirtyMinutesAgo) } as any,
    });

    for (const task of completedCounts) {
      exceptions.push({
        id: `CC-${task.id}`,
        type: 'CYCLE_COUNT_DISCREPANCY',
        severity: 'medium',
        since_min: Math.floor((now - new Date(task.updated_at).getTime()) / 60000),
        status: 'AWAITING_RECONCILE',
        title: `Popis ${task.target_code} završen ali nije pomiren`,
        details: 'Potrebno pomirenje razlika',
        actions: ['OPEN_CYCLE_COUNT', 'RECONCILE'],
        cycle_count_task_id: task.id,
      });
    }

    return exceptions;
  }

  async reassignException(exceptionId: string, targetUserId?: number, teamId?: number) {
    const parts = exceptionId.split('-');
    const type = parts[0];

    // Get the exception to determine task type and ID
    const fullException = await this.getActiveExceptions();
    const exc = fullException.find(e => e.id === exceptionId);
    if (!exc) throw new NotFoundException('Exception not found');

    // Determine task type and ID
    let taskType: 'RECEIVING' | 'SHIPPING' | 'SKART' | 'POVRACAJ' | null = null;
    let taskId: number | null = null;

    if (type === 'REC' || exc.document_id) {
      taskType = 'RECEIVING';
      taskId = exc.document_id || parseInt(parts[1]);
    } else if (type === 'SHIP' || exc.shipping_order_id) {
      taskType = 'SHIPPING';
      if (exc.shipping_order_id) {
        taskId = exc.shipping_order_id;
      } else {
        const orderNumber = exceptionId.replace('SHIP-', '');
        const order = await this.shippingRepo.findOne({
          where: { order_number: orderNumber } as any,
        });
        if (!order) throw new NotFoundException('Order not found');
        taskId = order.id;
      }
    } else if (type === 'WORKER') {
      // For WORKER exceptions, check if it has document_id or shipping_order_id
      if (exc.document_id) {
        taskType = 'RECEIVING';
        taskId = exc.document_id;
      } else if (exc.shipping_order_id) {
        taskType = 'SHIPPING';
        taskId = exc.shipping_order_id;
      } else {
        throw new NotFoundException('Worker exception does not have associated task');
      }
    } else if (exc.type === 'SKART' && (exc).skart_document_id) {
      taskType = 'SKART';
      taskId = (exc).skart_document_id;
    } else if (exc.type === 'POVRACAJ' && (exc).povracaj_document_id) {
      taskType = 'POVRACAJ';
      taskId = (exc).povracaj_document_id;
    }

    if (!taskType || !taskId) {
      throw new NotFoundException('Exception type not supported for reassign');
    }

    // Use WorkforceService.assignTask for reassignment (supports both users and teams)
    await this.workforceService.assignTask(
      { id: 0, role: 'admin' }, // Actor for reassignment
      {
        type: taskType,
        task_id: taskId,
        assignees: targetUserId ? [targetUserId] : undefined,
        team_id: teamId,
        policy: 'ANY_DONE',
      }
    );

    return { ok: true, message: teamId ? 'Zadatak je preusmeren na tim' : 'Zadatak je preusmeren na radnika' };
  }

  async unholdException(exceptionId: string) {
    const parts = exceptionId.split('-');
    const type = parts[0];

    if (type === 'REC') {
      const docId = parseInt(parts[1]);
      await this.receivingService.setHold(docId, false);
      return { ok: true };
    } else if (type === 'SHIP') {
      // For shipping, we could add priority marking
      return { ok: true, message: 'Shipping unhold not implemented yet' };
    }
    throw new NotFoundException('Exception type not supported for unhold');
  }

  async acknowledgeException(exceptionKey: string, userId: number, userRole: string) {
    const log = this.ackLogRepo.create({
      exception_key: exceptionKey,
      ack_by_user_id: userId,
    });
    await this.ackLogRepo.save(log);

    // Get exception details to send priority notification
    const fullException = await this.getActiveExceptions();
    const exc = fullException.find(e => e.id === exceptionKey);
    
    if (exc && exc.assigned_worker) {
      // Send WebSocket notification to worker's PWA
      if (this.assignmentsGateway) {
        try {
          this.assignmentsGateway.server.emit('priority:alert', {
            user_id: exc.assigned_worker.id,
            exception_id: exceptionKey,
            exception_type: exc.type,
            title: exc.title,
            details: exc.details,
            priority: 'HIGH',
            message: 'Ovaj zadatak je označen kao prioritet! Završite ga što pre.',
            document_id: exc.document_id,
            shipping_order_id: exc.shipping_order_id,
            created_at: new Date(),
          });
        } catch (e) {
          console.error('Failed to send priority notification:', e);
        }
      }
    }

    return { ok: true, message: 'Izuzetak je označen kao prioritet i radnik je obavešten' };
  }

  async getAcknowledgedExceptions(userId: number): Promise<string[]> {
    const logs = await this.ackLogRepo.find({
      where: { ack_by_user_id: userId } as any,
    });
    return logs.map(l => l.exception_key);
  }
}

