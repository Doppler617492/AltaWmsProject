import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Location } from '../entities/location.entity';
import { CycleCountTask, CycleCountTaskStatus } from '../cycle-count/cycle-count-task.entity';
import { CycleCountLine } from '../cycle-count/cycle-count-line.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { SkartDocument, SkartStatus } from '../skart/entities/skart-document.entity';
import { PovracajDocument, PovracajStatus } from '../povracaj/entities/povracaj-document.entity';
import { AuditLog } from '../entities/audit-log.entity';

function startOfToday(): Date {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ReceivingDocument) private recvRepo: Repository<ReceivingDocument>,
    @InjectRepository(ShippingOrder) private shippingRepo: Repository<ShippingOrder>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserShift) private shiftRepo: Repository<UserShift>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(InventoryMovement) private movRepo: Repository<InventoryMovement>,
    @InjectRepository(Location) private locRepo: Repository<Location>,
    @InjectRepository(CycleCountTask) private ccTaskRepo: Repository<CycleCountTask>,
    @InjectRepository(CycleCountLine) private ccLineRepo: Repository<CycleCountLine>,
    @InjectRepository(SkartDocument) private skartRepo: Repository<SkartDocument>,
    @InjectRepository(PovracajDocument) private povracajRepo: Repository<PovracajDocument>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async getOverview() {
    const today = startOfToday();

    // Parallelize independent queries for better performance
    const [
      // Receiving summary - parallel
      recvTotalToday,
      recvInProgress,
      recvOnHold,
      recvCompletedToday,
      recvCompletedRows,
      // Shipping summary - parallel
      shipTotalToday,
      shipInProgress,
      shipWaiting,
      shipCompletedRows,
      // Workforce - parallel
      workers,
      shiftRows,
      assignedDocs,
      openCC,
      // Inventory - parallel
      skuRows,
      qtyRows,
      invAgg,
      lastMov,
      // Cycle count - parallel
      openTasks,
      inProgressCc,
      waitingReconcile,
      reconciledToday,
      cutoff,
      compTasks,
      // SKART - parallel
      skartTotalToday,
      skartSubmitted,
      skartCompletedToday,
      skartCompletedRows,
      // Povraćaj - parallel
      povracajTotalToday,
      povracajSubmitted,
      povracajCompletedToday,
      povracajCompletedRows,
    ] = await Promise.all([
      // Receiving
      this.recvRepo.createQueryBuilder('d').where('d.created_at >= :t', { t: today.toISOString() }).getCount(),
      this.recvRepo.count({ where: { status: ReceivingStatus.IN_PROGRESS } }),
      this.recvRepo.count({ where: { status: ReceivingStatus.ON_HOLD } }),
      this.recvRepo.createQueryBuilder('d').where('d.status = :st', { st: ReceivingStatus.COMPLETED }).andWhere('d.completed_at >= :t', { t: today.toISOString() }).getCount(),
      this.recvRepo.createQueryBuilder('d').select(['d.started_at AS started_at','d.created_at AS created_at','d.completed_at AS completed_at']).where('d.status = :st', { st: ReceivingStatus.COMPLETED }).andWhere('d.completed_at >= :t', { t: today.toISOString() }).getRawMany(),
      // Shipping
      this.shippingRepo.createQueryBuilder('o').where('o.created_at >= :t', { t: today.toISOString() }).getCount(),
      this.shippingRepo.count({ where: { status: 'PICKING' } as any }),
      this.shippingRepo.createQueryBuilder('o').where('o.status IN (:...st)', { st: ['DRAFT', 'ON_HOLD'] }).getCount(),
      this.shippingRepo.createQueryBuilder('o').select(['o.started_at AS started_at','o.created_at AS created_at','o.staged_at AS staged_at','o.loaded_at AS loaded_at','o.closed_at AS closed_at']).where('o.status IN (:...st)', { st: ['STAGED', 'LOADED', 'CLOSED', 'COMPLETED'] }).andWhere('(o.staged_at >= :t OR o.loaded_at >= :t OR o.closed_at >= :t)', { t: today.toISOString() }).getRawMany(),
      // Workforce
      this.userRepo.find({ where: { role: 'magacioner' as any } }),
      this.shiftRepo.find({ where: { shift_date: this.todayDateString() } as any }),
      this.recvRepo.createQueryBuilder('d').select(['d.assigned_to AS uid', 'COUNT(*) AS cnt']).where('d.status IN (:...st)', { st: [ReceivingStatus.IN_PROGRESS, ReceivingStatus.ON_HOLD] }).groupBy('d.assigned_to').getRawMany(),
      this.ccTaskRepo.createQueryBuilder('t').select(['t.assigned_to_user_id AS uid', 'COUNT(*) AS cnt']).where("t.status != 'RECONCILED'").andWhere("t.status != 'COMPLETED'").groupBy('t.assigned_to_user_id').getRawMany(),
      // Inventory
      this.invRepo.createQueryBuilder('inv').select('COUNT(DISTINCT inv.item_id)', 'cnt').getRawOne(),
      this.invRepo.createQueryBuilder('inv').select('SUM(inv.quantity::numeric)', 'sum').getRawOne(),
      this.invRepo.createQueryBuilder('inv').leftJoin(Location, 'loc', 'loc.id = inv.location_id').select(['loc.code AS code', 'loc.capacity AS cap', 'SUM(inv.quantity::numeric) AS qty']).groupBy('loc.code').addGroupBy('loc.capacity').getRawMany(),
      this.movRepo.createQueryBuilder('m').leftJoin(Location, 'tl', 'tl.id = m.to_location_id').select(['m.item_id AS item_id','m.to_location_id AS lid','m.quantity_change AS q','m.created_at AS ca']).orderBy('m.created_at','DESC').limit(200).getRawMany(),
      // Cycle count
      this.ccTaskRepo.createQueryBuilder('t').where("t.status NOT IN ('COMPLETED','RECONCILED')").getCount(),
      this.ccTaskRepo.count({ where: { status: CycleCountTaskStatus.IN_PROGRESS } }),
      this.ccTaskRepo.count({ where: { status: CycleCountTaskStatus.COMPLETED } }),
      this.ccTaskRepo.createQueryBuilder('t').where("t.status = 'RECONCILED'").andWhere('t.updated_at >= :t', { t: today.toISOString() }).getCount(),
      new Date(Date.now() - 24*3600*1000),
      this.ccTaskRepo.createQueryBuilder('t').select('t.id','id').where('t.status = :st', { st: CycleCountTaskStatus.COMPLETED }).andWhere('t.updated_at >= :c', { c: new Date(Date.now() - 24*3600*1000).toISOString() }).getRawMany(),
      // SKART
      this.skartRepo.createQueryBuilder('sd').where('sd.created_at >= :t', { t: today.toISOString() }).getCount(),
      this.skartRepo.count({ where: { status: SkartStatus.SUBMITTED } }),
      this.skartRepo.createQueryBuilder('sd').where('sd.status = :st', { st: SkartStatus.RECEIVED }).andWhere('sd.received_at >= :t', { t: today.toISOString() }).getCount(),
      this.skartRepo.createQueryBuilder('sd').select(['sd.created_at AS created_at', 'sd.received_at AS received_at']).where('sd.status = :st', { st: SkartStatus.RECEIVED }).andWhere('sd.received_at >= :t', { t: today.toISOString() }).getRawMany(),
      // Povraćaj
      this.povracajRepo.createQueryBuilder('pd').where('pd.created_at >= :t', { t: today.toISOString() }).getCount(),
      this.povracajRepo.count({ where: { status: PovracajStatus.SUBMITTED } }),
      this.povracajRepo.createQueryBuilder('pd').where('pd.status = :st', { st: PovracajStatus.RECEIVED }).andWhere('pd.received_at >= :t', { t: today.toISOString() }).getCount(),
      this.povracajRepo.createQueryBuilder('pd').select(['pd.created_at AS created_at', 'pd.received_at AS received_at']).where('pd.status = :st', { st: PovracajStatus.RECEIVED }).andWhere('pd.received_at >= :t', { t: today.toISOString() }).getRawMany(),
    ]);

    // Process receiving summary
    const total_today = recvTotalToday;
    const in_progress = recvInProgress;
    const on_hold = recvOnHold;
    const completed_today = recvCompletedToday;
    let avg_close_time_min = 0;
    if (recvCompletedRows.length) {
      const sum = recvCompletedRows.reduce((acc, r) => {
        const start = r.started_at || r.created_at; if (!start || !r.completed_at) return acc;
        const ms = new Date(r.completed_at).getTime() - new Date(start).getTime();
        return acc + Math.max(0, ms);
      }, 0);
      avg_close_time_min = Math.round(sum / recvCompletedRows.length / 60000);
    }

    // Process shipping summary
    const ship_completed_today = shipCompletedRows.length;
    let ship_avg_close_time_min = 0;
    if (shipCompletedRows.length) {
      const sum = shipCompletedRows.reduce((acc, r) => {
        const start = r.started_at || r.created_at; if (!start) return acc;
        const finish = r.closed_at || r.loaded_at || r.staged_at;
        if (!finish) return acc;
        const ms = new Date(finish).getTime() - new Date(start).getTime();
        return acc + Math.max(0, ms);
      }, 0);
      ship_avg_close_time_min = Math.round(sum / shipCompletedRows.length / 60000);
    }

    // Process workforce summary
    const activeWorkers = workers.filter(w => (w.active ?? (w as any).is_active) !== false);
    const total_workers = activeWorkers.length;
    const online_now = activeWorkers.filter(w => w.last_activity && (Date.now() - new Date(w.last_activity).getTime()) <= 120000).length;
    const shifts = ['PRVA','DRUGA','OFF'] as const;
    const by_shift = await Promise.all(shifts.map(async st => {
      const ids = shiftRows.filter(s => s.shift_type === st).map(s => s.user_id);
      const count = ids.length;
      const busy = count ? await this.recvRepo.createQueryBuilder('d').where('d.assigned_to IN (:...ids)', { ids }).andWhere('d.status IN (:...st)', { st: [ReceivingStatus.IN_PROGRESS, ReceivingStatus.ON_HOLD] }).getCount() : 0;
      return { shift_type: st, count, busy };
    }));
    const assignedMap = new Map<number, number>();
    assignedDocs.forEach(r => assignedMap.set(Number(r.uid), Number(r.cnt)));
    const ccMap = new Map<number, number>();
    openCC.forEach(r => ccMap.set(Number(r.uid), Number(r.cnt)));
    const top_busy_workers = activeWorkers.map(w => ({
      user_id: w.id,
      full_name: (w as any).full_name || w.name || w.username,
      open_receivings: assignedMap.get(w.id) || 0,
      open_cycle_counts: ccMap.get(w.id) || 0,
      last_activity_min_ago: w.last_activity ? Math.round((Date.now() - new Date(w.last_activity).getTime())/60000) : null,
    })).sort((a,b) => (b.open_receivings + b.open_cycle_counts) - (a.open_receivings + a.open_cycle_counts)).slice(0,5);

    // Process inventory summary - optimize conflicts check
    let over_capacity = 0, negative_stock = 0;
    for (const r of invAgg) {
      const qty = parseFloat(String(r.qty || '0'));
      const cap = Number(r.cap || 0);
      if (qty < 0) negative_stock++;
      if (cap > 0 && qty > cap) over_capacity++;
    }
    // Optimize conflicts: batch load all inventory records needed
    const locationIds = [...new Set(lastMov.filter(r => r.lid).map(r => Number(r.lid)))];
    const itemIds = [...new Set(lastMov.map(r => Number(r.item_id)))];
    const invRecords = locationIds.length > 0 && itemIds.length > 0
      ? await this.invRepo.find({ where: { location_id: In(locationIds), item_id: In(itemIds) } })
      : [];
    const invMap = new Map<string, number>();
    invRecords.forEach(inv => {
      const key = `${inv.item_id}_${inv.location_id}`;
      invMap.set(key, parseFloat(String(inv.quantity)));
    });
    let recent_conflicts = 0;
    for (const r of lastMov) {
      if (!r.lid) continue;
      const key = `${r.item_id}_${r.lid}`;
      const current = invMap.get(key) || 0;
      const diff = Math.abs(Number(r.q || 0));
      if (current > 0 && diff / current > 0.1) recent_conflicts++;
    }

    // Process cycle count summary
    const open_tasks = openTasks;
    const in_progress_cc = inProgressCc;
    const waiting_reconcile = waitingReconcile;
    const reconciled_today = reconciledToday;
    let sumExpected = 0, sumDiffAbs = 0;
    if (compTasks.length) {
      const ids = compTasks.map(r => Number(r.id));
      const lines = await this.ccLineRepo.createQueryBuilder('l').where('l.task_id IN (:...ids)', { ids }).getMany();
      for (const l of lines) {
        const expected = parseFloat(String(l.system_qty || '0'));
        const counted = parseFloat(String(l.counted_qty || '0'));
        sumExpected += Math.max(0, expected);
        sumDiffAbs += Math.abs(counted - expected);
      }
    }
    const accuracy_estimate_pct = sumExpected > 0 ? Math.max(0, Math.min(100, Math.round(100 - (sumDiffAbs / sumExpected) * 100))) : 100;

    // Process SKART summary
    let skart_avg_close_time_min = 0;
    if (skartCompletedRows.length) {
      const sum = skartCompletedRows.reduce((acc, r) => {
        if (!r.created_at || !r.received_at) return acc;
        const ms = new Date(r.received_at).getTime() - new Date(r.created_at).getTime();
        return acc + Math.max(0, ms);
      }, 0);
      skart_avg_close_time_min = Math.round(sum / skartCompletedRows.length / 60000);
    }

    // Process Povraćaj summary
    let povracaj_avg_close_time_min = 0;
    if (povracajCompletedRows.length) {
      const sum = povracajCompletedRows.reduce((acc, r) => {
        if (!r.created_at || !r.received_at) return acc;
        const ms = new Date(r.received_at).getTime() - new Date(r.created_at).getTime();
        return acc + Math.max(0, ms);
      }, 0);
      povracaj_avg_close_time_min = Math.round(sum / povracajCompletedRows.length / 60000);
    }

    return {
      receivingSummary: { total_today, in_progress, on_hold, completed_today, avg_close_time_min },
      shippingSummary: { total_today: shipTotalToday, in_progress: shipInProgress, waiting: shipWaiting, completed_today: ship_completed_today, avg_close_time_min: ship_avg_close_time_min },
      skartSummary: { total_today: skartTotalToday, submitted: skartSubmitted, completed_today: skartCompletedToday, avg_close_time_min: skart_avg_close_time_min },
      povracajSummary: { total_today: povracajTotalToday, submitted: povracajSubmitted, completed_today: povracajCompletedToday, avg_close_time_min: povracaj_avg_close_time_min },
      workforceSummary: { total_workers, online_now, by_shift, top_busy_workers },
      inventorySummary: { total_sku: Number(skuRows?.cnt || 0), total_qty: Number(qtyRows?.sum || 0), hotspots: { over_capacity, negative_stock, recent_conflicts } },
      cycleCountSummary: { open_tasks, in_progress: in_progress_cc, waiting_reconcile, reconciled_today, accuracy_estimate_pct },
    };
  }

  async getLiveEvents(limit: number = 100) {
    // Get recent audit logs
    const logs = await this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .limit(limit)
      .getMany();

    // Get user details for actor_ids
    const actorIds = [...new Set(logs.map(l => l.actor_id).filter(Boolean))];
    const users = actorIds.length > 0 
      ? await this.userRepo.find({ where: { id: In(actorIds) } })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Format events with user information
    const events = logs.map(log => {
      const translateAction = (action: string): string => {
        const map: Record<string, string> = {
          'CREATE': 'kreirao',
          'UPDATE': 'ažurirao',
          'DELETE': 'obrisao',
          'SUBMIT': 'poslao',
          'RECEIVE': 'primio',
          'START': 'započeo',
          'COMPLETE': 'završio',
          'ASSIGN': 'dodelio',
          'UNASSIGN': 'uklonio dodelu',
          'APPROVE': 'odobrio',
          'REJECT': 'odbio',
          'CANCEL': 'otkazao',
          'HOLD': 'stavio na čekanje',
          'RESUME': 'nastavio',
        };
        return map[action] || action.toLowerCase();
      };
      const translateEntity = (entity: string): string => {
        const map: Record<string, string> = {
            'ReceivingDocument': 'prijem',
            'ShippingOrder': 'otpremu',
            'SKART_DOCUMENT': 'skart',
            'SkartDocument': 'skart',
            'PovracajDocument': 'povraćaj',
            'CycleCountTask': 'popis',
            'InventoryMovement': 'kretanje zaliha',
            'User': 'korisnika',
            'Team': 'tim',
            'TaskAssignment': 'dodelu zadatka',
        };
        return map[entity] || entity.toLowerCase();
      };
      const actionLabel = translateAction(log.action);
      const entityLabel = translateEntity(log.entity);
      const user = log.actor_id ? userMap.get(log.actor_id) : null;
      
      let description = `${actionLabel} ${entityLabel}`;
      if (log.payload) {
        if (log.payload.document_number) {
          description += ` ${log.payload.document_number}`;
        } else if (log.payload.order_number) {
          description += ` ${log.payload.order_number}`;
        } else if (log.payload.uid) {
          description += ` ${log.payload.uid}`;
        } else if (log.payload.name) {
          description += ` "${log.payload.name}"`;
        }
      }

      return {
        id: log.id,
        entity: log.entity,
        entity_id: log.entity_id,
        action: actionLabel,
        description,
        actor: user ? {
          id: user.id,
          name: (user as any).full_name || user.name || user.username,
          role: user.role,
        } : null,
        payload: log.payload,
        created_at: log.created_at,
      };
    });

    return events;
  }

  private todayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  async clearLiveEvents() {
    const total = await this.auditRepo.count();
    await this.auditRepo.clear();
    return { cleared: total };
  }
}

