import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { CycleCountTask, CycleCountTaskStatus } from '../cycle-count/cycle-count-task.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Inventory } from '../entities/inventory.entity';
import { Location } from '../entities/location.entity';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { Zone } from '../entities/zone.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { Item } from '../entities/item.entity';
import { SkartDocument, SkartStatus } from '../skart/entities/skart-document.entity';
import { SkartItem } from '../skart/entities/skart-item.entity';
import { PovracajDocument, PovracajStatus } from '../povracaj/entities/povracaj-document.entity';
import { PovracajItem } from '../povracaj/entities/povracaj-item.entity';

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(ReceivingDocument) private receivingRepo: Repository<ReceivingDocument>,
    @InjectRepository(ReceivingItem) private receivingItemRepo: Repository<ReceivingItem>,
    @InjectRepository(PutawayTask) private putawayRepo: Repository<PutawayTask>,
    @InjectRepository(ShippingOrder) private shippingRepo: Repository<ShippingOrder>,
    @InjectRepository(ShippingOrderLine) private shippingLineRepo: Repository<ShippingOrderLine>,
    @InjectRepository(CycleCountTask) private cycleCountRepo: Repository<CycleCountTask>,
    @InjectRepository(InventoryMovement) private movementRepo: Repository<InventoryMovement>,
    @InjectRepository(Inventory) private inventoryRepo: Repository<Inventory>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserShift) private shiftRepo: Repository<UserShift>,
    @InjectRepository(Zone) private zoneRepo: Repository<Zone>,
    @InjectRepository(TaskAssignee) private taskAssigneeRepo: Repository<TaskAssignee>,
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(SkartDocument) private skartRepo: Repository<SkartDocument>,
    @InjectRepository(SkartItem) private skartItemRepo: Repository<SkartItem>,
    @InjectRepository(PovracajDocument) private povracajRepo: Repository<PovracajDocument>,
    @InjectRepository(PovracajItem) private povracajItemRepo: Repository<PovracajItem>,
  ) {}

  async getOverview() {
    try {
    const today = todayStart();
    const now = Date.now();

    // Receivings today
    const receivingsToday = await this.receivingRepo
      .createQueryBuilder('rd')
      .where('COALESCE(rd.completed_at, rd.started_at, rd.created_at) >= :today', { today })
      .getCount();

    // Putaways today (DONE status, completed_at today)
    const putawaysToday = await this.putawayRepo
      .createQueryBuilder('pt')
      .where('pt.status = :status', { status: 'DONE' })
      .andWhere('pt.completed_at >= :today', { today })
      .getCount();

    // Shipments today (PICKING/STAGED/LOADED/CLOSED within the day)
    const shipmentsToday = await this.shippingRepo
      .createQueryBuilder('so')
      .where('so.status IN (:...shipStatuses)', { shipStatuses: ['PICKING', 'STAGED', 'LOADED', 'CLOSED'] })
      .andWhere('COALESCE(so.closed_at, so.loaded_at, so.staged_at, so.started_at) >= :today', { today })
      .getCount();

    // Cycle counts today (RECONCILED)
    const cycleCountsToday = await this.cycleCountRepo
      .createQueryBuilder('cc')
      .where('cc.status = :status', { status: CycleCountTaskStatus.RECONCILED })
      .andWhere('cc.updated_at >= :today', { today })
      .getCount();

    // SKART documents today (RECEIVED status, received_at today)
    const skartToday = await this.skartRepo
      .createQueryBuilder('sd')
      .where('sd.status = :status', { status: SkartStatus.RECEIVED })
      .andWhere('sd.received_at >= :today', { today })
      .getCount();

    // Povraćaj documents today (RECEIVED status, received_at today)
    const povracajToday = await this.povracajRepo
      .createQueryBuilder('pd')
      .where('pd.status = :status', { status: PovracajStatus.RECEIVED })
      .andWhere('pd.received_at >= :today', { today })
      .getCount();

    // Active workers (last_activity < 2 minutes)
    const twoMinutesAgo = new Date(now - 120000);
    const allUsers = await this.userRepo.find();
    const activeWorkers = allUsers.filter(u =>
      u.last_activity && new Date(u.last_activity).getTime() > twoMinutesAgo.getTime()
    ).length;

    // Avg pallets per worker: total quantity from today's tasks / active workers
    const putawayTasksToday = await this.putawayRepo
      .createQueryBuilder('pt')
      .where('pt.completed_at >= :today', { today })
      .getMany();
    const shippingLinesToday = await this.shippingRepo
      .createQueryBuilder('so')
      .leftJoinAndSelect('so.lines', 'lines')
      .where('COALESCE(so.closed_at, so.loaded_at, so.staged_at, so.started_at) >= :today', { today })
      .getMany();

    let totalQty = 0;
    putawayTasksToday.forEach(pt => { totalQty += parseFloat(pt.quantity || '0'); });
    shippingLinesToday.forEach(so => {
      so.lines?.forEach(line => {
        totalQty += parseFloat(line.requested_qty || '0');
      });
    });
    const avgPalletsPerWorker = activeWorkers > 0 ? totalQty / activeWorkers : 0;

    // Warehouse fill ratio: average fillRatio of all RACK locations
    const locations = await this.locationRepo.find({ relations: ['rack'] });
    const fillRatios: number[] = [];
    for (const loc of locations) {
      const inv = await this.inventoryRepo.find({ where: { location_id: loc.id } });
      const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const cap = loc.capacity || 0;
      if (cap > 0) {
        fillRatios.push(used / cap);
      }
    }
    const warehouseFillRatio = fillRatios.length > 0
      ? fillRatios.reduce((a, b) => a + b, 0) / fillRatios.length
      : 0;

    // Open tasks
    const openReceivings = await this.receivingRepo
      .createQueryBuilder('rd')
      .where('rd.status IN (:...statuses)', { statuses: ['in_progress', 'on_hold'] })
      .getCount();
    const openPutaways = await this.putawayRepo
      .createQueryBuilder('pt')
      .where('pt.status IN (:...statuses)', { statuses: ['ASSIGNED', 'IN_PROGRESS'] })
      .getCount();
    const openShipments = await this.shippingRepo
      .createQueryBuilder('so')
      .where('so.status IN (:...statuses)', { statuses: ['PICKING', 'STAGED'] })
      .getCount();
    const openSkart = await this.skartRepo
      .createQueryBuilder('sd')
      .where('sd.status = :status', { status: SkartStatus.SUBMITTED })
      .getCount();
    const openPovracaj = await this.povracajRepo
      .createQueryBuilder('pd')
      .where('pd.status = :status', { status: PovracajStatus.SUBMITTED })
      .getCount();

    // Alerts
    // Overloaded locations (fillRatio >= 1)
    let overloadedCount = 0;
    for (const loc of locations) {
      const inv = await this.inventoryRepo.find({ where: { location_id: loc.id } });
      const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const cap = loc.capacity || 0;
      if (cap > 0 && used / cap >= 1) overloadedCount++;
    }

    // Blocked putaways
    const blockedPutaways = await this.putawayRepo
      .createQueryBuilder('pt')
      .where('pt.status = :status', { status: 'BLOCKED' })
      .getCount();

    // Stalled orders (PICKING status, started_at older than 1 hour)
    const oneHourAgo = new Date(now - 3600000);
    const stalledOrders = await this.shippingRepo
      .createQueryBuilder('so')
      .where('so.status = :status', { status: 'PICKING' })
      .andWhere('so.started_at < :oneHourAgo', { oneHourAgo })
      .getCount();

    return {
      receivings_today: receivingsToday,
      putaways_today: putawaysToday,
      shipments_today: shipmentsToday,
      cycle_counts_today: cycleCountsToday,
      skart_today: skartToday,
      povracaj_today: povracajToday,
      active_workers: activeWorkers,
      avg_pallets_per_worker: Math.round(avgPalletsPerWorker * 10) / 10,
      warehouse_fill_ratio: Math.round(warehouseFillRatio * 100) / 100,
      open_tasks: {
        receivings: openReceivings,
        putaways: openPutaways,
        shipments: openShipments,
        skart: openSkart,
        povracaj: openPovracaj,
      },
      alerts: {
        overloaded_locations: overloadedCount,
        blocked_putaways: blockedPutaways,
        stalled_orders: stalledOrders,
      },
    };
    } catch (error: any) {
      console.error('KPI getOverview error:', error);
      // Return safe defaults on error
      return {
        receivings_today: 0,
        putaways_today: 0,
        shipments_today: 0,
        cycle_counts_today: 0,
        skart_today: 0,
        povracaj_today: 0,
        active_workers: 0,
        avg_pallets_per_worker: 0,
        warehouse_fill_ratio: 0,
        open_tasks: {
          receivings: 0,
          putaways: 0,
          shipments: 0,
          skart: 0,
          povracaj: 0,
        },
        alerts: {
          overloaded_locations: 0,
          blocked_putaways: 0,
          stalled_orders: 0,
        },
      };
    }
  }

  async getWorkers() {
    try {
    const today = todayStart();
    const todayStr = today.toISOString().split('T')[0];
    const twoMinutesAgo = new Date(Date.now() - 120000);

    // Get all warehouse workers (magacioner role)
    const workers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: 'magacioner' })
      .getMany();

    // Get today's shifts
    const shifts = await this.shiftRepo
      .createQueryBuilder('us')
      .where('us.shift_date = :todayStr', { todayStr })
      .getMany();
    const shiftMap = new Map(shifts.map(s => [s.user_id, s.shift_type]));

    const allReceivings = await this.receivingRepo.find();
    const todaysReceivings = allReceivings.filter(rd => {
      const pivot = rd.completed_at || rd.started_at || rd.created_at;
      return pivot ? new Date(pivot).getTime() >= today.getTime() : false;
    });

    const allPutaways = await this.putawayRepo.find();
    const todaysPutaways = allPutaways.filter(pt =>
      pt.completed_at ? new Date(pt.completed_at).getTime() >= today.getTime() : false
    );

    const allShipments = await this.shippingRepo.find();
    const todaysShipments = allShipments.filter(so => {
      const pivot = so.closed_at || so.loaded_at || so.staged_at || so.started_at;
      return pivot ? new Date(pivot).getTime() >= today.getTime() : false;
    });

    const allCycleCounts = await this.cycleCountRepo.find();
    const todaysCycleCounts = allCycleCounts.filter(cc =>
      cc.status === CycleCountTaskStatus.RECONCILED &&
      cc.updated_at ? new Date(cc.updated_at).getTime() >= today.getTime() : false
    );

    const allSkart = await this.skartRepo.find();
    const todaysSkart = allSkart.filter(sd =>
      sd.status === SkartStatus.RECEIVED &&
      sd.received_at ? new Date(sd.received_at).getTime() >= today.getTime() : false
    );

    const allPovracaj = await this.povracajRepo.find();
    const todaysPovracaj = allPovracaj.filter(pd =>
      pd.status === PovracajStatus.RECEIVED &&
      pd.received_at ? new Date(pd.received_at).getTime() >= today.getTime() : false
    );

    const result = [];
    for (const worker of workers) {
      const userId = worker.id;

      // Receivings completed/started today by this worker
      const numericUserId = Number(userId);

      const receivings = todaysReceivings.filter(rd => {
        const receivedBy = rd.received_by ? Number(rd.received_by) : null;
        const assignedTo = rd.assigned_to ? Number(rd.assigned_to) : null;
        return receivedBy === numericUserId || assignedTo === numericUserId;
      });

      const putawayTasks = todaysPutaways.filter(pt => {
        const assignedId = (pt as any).assignedUserId ?? pt.assigned_user?.id;
        return assignedId ? Number(assignedId) === numericUserId : false;
      });

      const shippingOrders = todaysShipments.filter(so => {
        const assigned = so.assigned_user_id ?? so.assigned_user?.id;
        return assigned ? Number(assigned) === numericUserId : false;
      });

      const cycleCountTasks = todaysCycleCounts.filter(cc =>
        cc.assigned_to_user_id ? Number(cc.assigned_to_user_id) === numericUserId : false
      );

      const skartTasks = todaysSkart.filter(sd =>
        sd.assigned_to_user_id ? Number(sd.assigned_to_user_id) === numericUserId : false
      );

      const povracajTasks = todaysPovracaj.filter(pd =>
        pd.assigned_to_user_id ? Number(pd.assigned_to_user_id) === numericUserId : false
      );

      const receivingsDone = receivings.length;
      const shipmentsDone = shippingOrders.length;
      const cycleCountsDone = cycleCountTasks.length;
      const putawaysDone = putawayTasks.length;
      const skartDone = skartTasks.length;
      const povracajDone = povracajTasks.length;

      let totalMinutes = 0;
      let taskCount = 0;
      putawayTasks.forEach(pt => {
        if (pt.started_at && pt.completed_at) {
          const mins = (new Date(pt.completed_at).getTime() - new Date(pt.started_at).getTime()) / 60000;
          totalMinutes += mins;
          taskCount++;
        }
      });
      shippingOrders.forEach(so => {
        const finishedAt = so.closed_at || so.loaded_at || so.staged_at;
        if (so.started_at && finishedAt) {
          const mins = (new Date(finishedAt).getTime() - new Date(so.started_at).getTime()) / 60000;
          if (!Number.isNaN(mins) && mins >= 0) {
            totalMinutes += mins;
            taskCount++;
          }
        }
      });
      const avgTaskTimeMin = taskCount > 0 ? Math.round((totalMinutes / taskCount) * 10) / 10 : 0;

      // Online status
      const online = worker.last_activity
        ? new Date(worker.last_activity).getTime() > twoMinutesAgo.getTime()
        : false;

      // Shift duration (PRVA: 07-15, DRUGA: 15-23) = 8 hours
      const shiftType = shiftMap.get(userId) || worker.shift || 'OFF';
      const shiftDurationHr = ['PRVA', 'DRUGA'].includes(shiftType) ? 8 : 0;

      // Efficiency score (0-100) - dodaj SKART i Povraćaj u izračun
      const efficiency = shiftDurationHr > 0
        ? Math.min(
            100,
            Math.round(
              ((putawaysDone + shipmentsDone * 1.2 + receivingsDone * 0.8 + cycleCountsDone * 0.6 + skartDone * 0.7 + povracajDone * 0.7) / shiftDurationHr) * 100
            ) / 10
          )
        : 0;

      result.push({
        worker_name: worker.full_name || worker.name,
        role: worker.role,
        shift: shiftType,
        receivings_done: receivingsDone,
        putaways_done: putawaysDone,
        shipments_done: shipmentsDone,
        cycle_counts_done: cycleCountsDone,
        skart_done: skartDone,
        povracaj_done: povracajDone,
        avg_task_time_min: avgTaskTimeMin,
        online,
        efficiency_score: efficiency,
        user_id: userId,
      });
    }

    return result;
    } catch (error: any) {
      console.error('KPI getWorkers error:', error);
      return [];
    }
  }

  async getWarehouseHeatmap() {
    try {
    const zones = await this.zoneRepo.find({ relations: ['aisles', 'aisles.racks', 'aisles.racks.locations'] });
    const result = [];

    for (const zone of zones) {
      if (zone.is_virtual) continue;

      const fillRatios: number[] = [];
      for (const aisle of zone.aisles || []) {
        for (const rack of aisle.racks || []) {
          for (const location of rack.locations || []) {
            const inv = await this.inventoryRepo.find({ where: { location_id: location.id } });
            const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
            const cap = location.capacity || 0;
            if (cap > 0) {
              fillRatios.push(used / cap);
            }
          }
        }
      }

      const avgFillRatio = fillRatios.length > 0
        ? fillRatios.reduce((a, b) => a + b, 0) / fillRatios.length
        : 0;

      result.push({
        zone: zone.name,
        fillRatio: Math.round(avgFillRatio * 100) / 100,
      });
    }

    return result;
    } catch (error: any) {
      console.error('KPI getWarehouseHeatmap error:', error);
      return [];
    }
  }

  async getWorkerById(userId: number) {
    try {
    const today = todayStart();
    const twoMinutesAgo = new Date(Date.now() - 120000);
    const worker = await this.userRepo.findOne({ where: { id: userId } });

    if (!worker) return null;

    // Get all tasks assigned to this worker via TaskAssignee or direct assignment
    const taskAssignments = await this.taskAssigneeRepo.find({
      where: { user_id: userId, status: In(['ASSIGNED', 'IN_PROGRESS', 'DONE']) } as any,
    });

    // Get receiving documents assigned to this worker
    const receivingAssignments = taskAssignments.filter(ta => ta.task_type === 'RECEIVING');
    const receivingDocIds = receivingAssignments.map(ta => ta.task_id);
    const receivingDocs = receivingDocIds.length > 0
      ? await this.receivingRepo.find({
          where: { id: In(receivingDocIds) },
          relations: ['supplier'],
        })
      : [];
    
    // Also check legacy assigned_to field
    const legacyReceivingDocs = await this.receivingRepo.find({
      where: { assigned_to: userId },
      relations: ['supplier'],
    });
    const allReceivingDocIds = [...new Set([...receivingDocIds, ...legacyReceivingDocs.map(d => d.id)])];
    const allReceivingDocs = await this.receivingRepo.find({
      where: { id: In(allReceivingDocIds) },
      relations: ['supplier'],
    });

    // Get receiving items with timing
    const receivingItems = allReceivingDocIds.length > 0
      ? await this.receivingItemRepo.find({
          where: { receiving_document_id: In(allReceivingDocIds) },
          relations: ['item'],
          order: { updated_at: 'ASC' },
        })
      : [];

    // Get shipping orders assigned to this worker
    const shippingAssignments = taskAssignments.filter(ta => ta.task_type === 'SHIPPING');
    const shippingOrderIds = shippingAssignments.map(ta => ta.task_id);
    const shippingOrders = shippingOrderIds.length > 0
      ? await this.shippingRepo.find({
          where: { id: In(shippingOrderIds) },
          relations: ['lines', 'lines.item'],
        })
      : [];
    
    // Also check legacy assigned_user_id
    const legacyShippingOrders = await this.shippingRepo.find({
      where: { assigned_user_id: userId },
      relations: ['lines', 'lines.item'],
    });
    const allShippingOrderIds = [...new Set([...shippingOrderIds, ...legacyShippingOrders.map(o => o.id)])];
    const allShippingOrders = await this.shippingRepo.find({
      where: { id: In(allShippingOrderIds) },
      relations: ['lines', 'lines.item'],
    });

    // Get shipping lines (no timing columns, will use order timing)
    // Note: ShippingOrderLine doesn't have order_id FK directly, need to load via orders
    const shippingLines: any[] = [];
    for (const order of allShippingOrders) {
      if (order.lines && order.lines.length > 0) {
        for (const line of order.lines) {
          shippingLines.push({
            ...line,
            order_id: order.id,
            order: order,
          });
        }
      }
    }

    // Get SKART documents assigned to this worker
    const skartDocs = await this.skartRepo.find({
      where: { assigned_to_user_id: userId },
      relations: ['store'],
    });
    
    // Get SKART items separately
    const skartDocIds = skartDocs.map(d => d.id);
    const skartItems = skartDocIds.length > 0
      ? await this.skartItemRepo.find({
          where: { document_id: In(skartDocIds) },
          order: { updated_at: 'ASC' },
        })
      : [];

    // Get Povracaj documents assigned to this worker
    const povracajDocs = await this.povracajRepo.find({
      where: { assigned_to_user_id: userId },
      relations: ['store'],
    });
    
    // Get Povracaj items separately
    const povracajDocIds = povracajDocs.map(d => d.id);
    const povracajItems = povracajDocIds.length > 0
      ? await this.povracajItemRepo.find({
          where: { document_id: In(povracajDocIds) },
          order: { updated_at: 'ASC' },
        })
      : [];

    // Process receiving tasks with item-level timing
    const receivingTasks = [];
    for (const doc of allReceivingDocs) {
      const assignment = receivingAssignments.find(ta => ta.task_id === doc.id) || 
        (legacyReceivingDocs.find(d => d.id === doc.id) ? { started_at: doc.started_at || doc.created_at, completed_at: doc.completed_at } : null);
      if (!assignment) continue;

      const docItems = receivingItems.filter(item => item.receiving_document_id === doc.id);
      const itemsWithTiming = docItems
        .filter(item => (item.received_quantity || 0) > 0)
        .map(item => {
          // Use updated_at when item was received (received_quantity > 0)
          const itemCompletedAt = item.updated_at;
          const itemStartedAt = item.created_at;
          const itemDurationMin = itemCompletedAt && itemStartedAt
            ? Math.round((new Date(itemCompletedAt).getTime() - new Date(itemStartedAt).getTime()) / 60000)
            : null;
          
          return {
            item_id: item.item_id,
            sku: item.item?.sku || '',
            name: item.item?.name || '',
            expected_qty: item.expected_quantity,
            received_qty: item.received_quantity,
            started_at: itemStartedAt,
            completed_at: itemCompletedAt,
            duration_min: itemDurationMin,
          };
        });

      const taskStartedAt = assignment.started_at || doc.started_at || doc.created_at;
      const taskCompletedAt = assignment.completed_at || doc.completed_at;
      const taskDurationMin = taskStartedAt && taskCompletedAt
        ? Math.round((new Date(taskCompletedAt).getTime() - new Date(taskStartedAt).getTime()) / 60000)
        : null;
      
      const avgItemTimeMin = itemsWithTiming.length > 0 && itemsWithTiming.filter(i => i.duration_min !== null).length > 0
        ? Math.round((itemsWithTiming.filter(i => i.duration_min !== null).reduce((sum, i) => sum + (i.duration_min || 0), 0) / itemsWithTiming.filter(i => i.duration_min !== null).length) * 10) / 10
        : null;

      receivingTasks.push({
        task_type: 'RECEIVING',
        task_id: doc.id,
        document_number: doc.document_number,
        supplier_name: doc.supplier?.name || '',
        started_at: taskStartedAt,
        completed_at: taskCompletedAt,
        duration_min: taskDurationMin,
        items_count: docItems.length,
        items_completed: itemsWithTiming.length,
        avg_item_time_min: avgItemTimeMin,
        items: itemsWithTiming,
      });
    }

    // Process shipping tasks with line-level timing
    const shippingTasks = [];
    for (const order of allShippingOrders) {
      const assignment = shippingAssignments.find(ta => ta.task_id === order.id) ||
        (legacyShippingOrders.find(o => o.id === order.id) ? { started_at: order.started_at || order.created_at, completed_at: order.closed_at || order.loaded_at || order.staged_at } : null);
      if (!assignment) continue;

      const orderLines = shippingLines.filter(line => {
        const orderId = (line.order)?.id || (line).order_id || (line.order?.id);
        return orderId === order.id;
      });
      
      // Calculate estimated time per line (divide order duration by number of lines)
      const taskStartedAt = assignment.started_at || order.started_at || order.created_at;
      const taskCompletedAt = assignment.completed_at || order.closed_at || order.loaded_at || order.staged_at;
      const orderDurationMin = taskStartedAt && taskCompletedAt
        ? Math.round((new Date(taskCompletedAt).getTime() - new Date(taskStartedAt).getTime()) / 60000)
        : null;
      
      const completedLines = orderLines.filter(line => parseFloat(line.picked_qty || '0') > 0);
      const estimatedTimePerLine = orderDurationMin !== null && completedLines.length > 0
        ? Math.round((orderDurationMin / completedLines.length) * 10) / 10
        : null;
      
      const linesWithTiming = completedLines.map((line, index) => {
        // Estimate line timing based on order timing and line position
        // First line starts when order starts, subsequent lines start after previous ones
        const lineStartOffset = estimatedTimePerLine ? (index * estimatedTimePerLine) : 0;
        const lineStartedAt = taskStartedAt
          ? new Date(new Date(taskStartedAt).getTime() + lineStartOffset * 60000)
          : null;
        const lineCompletedAt = estimatedTimePerLine && lineStartedAt
          ? new Date(new Date(lineStartedAt).getTime() + estimatedTimePerLine * 60000)
          : taskCompletedAt;
        
        return {
          line_id: line.id,
          sku: line.item?.sku || '',
          name: line.item?.name || '',
          requested_qty: parseFloat(line.requested_qty || '0'),
          picked_qty: parseFloat(line.picked_qty || '0'),
          started_at: lineStartedAt,
          completed_at: lineCompletedAt,
          duration_min: estimatedTimePerLine,
        };
      });

      const taskDurationMin = orderDurationMin;
      
      const avgLineTimeMin = estimatedTimePerLine;

      shippingTasks.push({
        task_type: 'SHIPPING',
        task_id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name || '',
        started_at: taskStartedAt,
        completed_at: taskCompletedAt,
        duration_min: taskDurationMin,
        lines_count: orderLines.length,
        lines_completed: linesWithTiming.length,
        avg_line_time_min: avgLineTimeMin,
        lines: linesWithTiming,
      });
    }

    // Process SKART tasks
    const skartTasks = [];
    for (const doc of skartDocs) {
      if (doc.status !== SkartStatus.RECEIVED || !doc.received_at) continue;
      
      const items = skartItems.filter(item => item.document_id === doc.id);
      const itemsWithTiming = items
        .filter(item => item.received_qty && parseFloat(item.received_qty) > 0)
        .map(item => {
          const itemCompletedAt = item.updated_at;
          const itemStartedAt = item.created_at;
          const itemDurationMin = itemCompletedAt && itemStartedAt
            ? Math.round((new Date(itemCompletedAt).getTime() - new Date(itemStartedAt).getTime()) / 60000)
            : null;
          
          return {
            item_id: item.item_id,
            code: item.code,
            name: item.name,
            qty: parseFloat(item.qty || '0'),
            received_qty: parseFloat(item.received_qty || '0'),
            reason: item.reason,
            started_at: itemStartedAt,
            completed_at: itemCompletedAt,
            duration_min: itemDurationMin,
          };
        });

      const taskStartedAt = doc.created_at;
      const taskCompletedAt = doc.received_at;
      const taskDurationMin = taskStartedAt && taskCompletedAt
        ? Math.round((new Date(taskCompletedAt).getTime() - new Date(taskStartedAt).getTime()) / 60000)
        : null;
      
      const avgItemTimeMin = itemsWithTiming.length > 0 && itemsWithTiming.filter(i => i.duration_min !== null).length > 0
        ? Math.round((itemsWithTiming.filter(i => i.duration_min !== null).reduce((sum, i) => sum + (i.duration_min || 0), 0) / itemsWithTiming.filter(i => i.duration_min !== null).length) * 10) / 10
        : null;

      skartTasks.push({
        task_type: 'SKART',
        task_id: doc.id,
        uid: doc.uid,
        store_name: doc.store?.name || '',
        started_at: taskStartedAt,
        completed_at: taskCompletedAt,
        duration_min: taskDurationMin,
        items_count: items.length,
        items_completed: itemsWithTiming.length,
        avg_item_time_min: avgItemTimeMin,
        items: itemsWithTiming,
      });
    }

    // Process Povracaj tasks
    const povracajTasks = [];
    for (const doc of povracajDocs) {
      if (doc.status !== PovracajStatus.RECEIVED || !doc.received_at) continue;
      
      const items = povracajItems.filter(item => item.document_id === doc.id);
      const itemsWithTiming = items
        .filter(item => item.received_qty && parseFloat(item.received_qty) > 0)
        .map(item => {
          const itemCompletedAt = item.updated_at;
          const itemStartedAt = item.created_at;
          const itemDurationMin = itemCompletedAt && itemStartedAt
            ? Math.round((new Date(itemCompletedAt).getTime() - new Date(itemStartedAt).getTime()) / 60000)
            : null;
          
          return {
            item_id: item.item_id,
            code: item.code,
            name: item.name,
            qty: parseFloat(item.qty || '0'),
            received_qty: parseFloat(item.received_qty || '0'),
            reason: item.reason,
            started_at: itemStartedAt,
            completed_at: itemCompletedAt,
            duration_min: itemDurationMin,
          };
        });

      const taskStartedAt = doc.created_at;
      const taskCompletedAt = doc.received_at;
      const taskDurationMin = taskStartedAt && taskCompletedAt
        ? Math.round((new Date(taskCompletedAt).getTime() - new Date(taskStartedAt).getTime()) / 60000)
        : null;
      
      const avgItemTimeMin = itemsWithTiming.length > 0 && itemsWithTiming.filter(i => i.duration_min !== null).length > 0
        ? Math.round((itemsWithTiming.filter(i => i.duration_min !== null).reduce((sum, i) => sum + (i.duration_min || 0), 0) / itemsWithTiming.filter(i => i.duration_min !== null).length) * 10) / 10
        : null;

      povracajTasks.push({
        task_type: 'POVRACAJ',
        task_id: doc.id,
        uid: doc.uid,
        store_name: doc.store?.name || '',
        started_at: taskStartedAt,
        completed_at: taskCompletedAt,
        duration_min: taskDurationMin,
        items_count: items.length,
        items_completed: itemsWithTiming.length,
        avg_item_time_min: avgItemTimeMin,
        items: itemsWithTiming,
      });
    }

    // Combine all tasks and sort by completed_at DESC
    const allTasks = [...receivingTasks, ...shippingTasks, ...skartTasks, ...povracajTasks]
      .sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return bTime - aTime;
      });

    // Movements today by hour (for hourly chart)
    const movements = await this.movementRepo
      .createQueryBuilder('m')
      .where('m.created_by = :userId', { userId })
      .andWhere('m.created_at >= :today', { today })
      .orderBy('m.created_at', 'ASC')
      .getMany();

    // Group by hour
    const hourlyData = new Map<number, number>();
    movements.forEach(m => {
      const hour = new Date(m.created_at).getHours();
      hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1);
    });

    // Calculate overall statistics
    const completedTasks = allTasks.filter(t => t.completed_at);
    const totalTasks = allTasks.length;
    const totalItems = allTasks.reduce((sum, t) => sum + (t.items?.length || t.lines?.length || 0), 0);
    const totalItemsCompleted = allTasks.reduce((sum, t) => sum + (t.items_completed || t.lines_completed || 0), 0);
    
    // Calculate average times
    const taskDurations = completedTasks.map(t => t.duration_min).filter(d => d !== null) as number[];
    const avgTaskTimeMin = taskDurations.length > 0
      ? Math.round((taskDurations.reduce((sum, d) => sum + d, 0) / taskDurations.length) * 10) / 10
      : null;

    const itemDurations: number[] = [];
    allTasks.forEach(task => {
      if (task.items) {
        task.items.forEach(item => {
          if (item.duration_min !== null) itemDurations.push(item.duration_min);
        });
      }
      if (task.lines) {
        task.lines.forEach(line => {
          if (line.duration_min !== null) itemDurations.push(line.duration_min);
        });
      }
    });
    const avgItemTimeMin = itemDurations.length > 0
      ? Math.round((itemDurations.reduce((sum, d) => sum + d, 0) / itemDurations.length) * 10) / 10
      : null;

    return {
      worker_name: worker.full_name || worker.name,
      hourly_tasks: Array.from(hourlyData.entries()).map(([hour, count]) => ({ hour, count })),
      online: worker.last_activity
        ? new Date(worker.last_activity).getTime() > twoMinutesAgo.getTime()
        : false,
      // Overall statistics
      total_tasks: totalTasks,
      completed_tasks: completedTasks.length,
      total_items: totalItems,
      total_items_completed: totalItemsCompleted,
      avg_task_time_min: avgTaskTimeMin,
      avg_item_time_min: avgItemTimeMin,
      // Detailed tasks
      tasks: allTasks,
    };
    } catch (error: any) {
      console.error('KPI getWorkerById error:', error);
      return null;
    }
  }

  async getTimeline() {
    try {
    const today = todayStart();
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 to 19:00

    const putawayToday = (await this.putawayRepo.find()).filter(pt =>
      pt.completed_at ? new Date(pt.completed_at).getTime() >= today.getTime() : false
    );
    const shippingToday = (await this.shippingRepo.find()).filter(so => {
      const pivot = so.closed_at || so.loaded_at || so.staged_at || so.started_at;
      return pivot ? new Date(pivot).getTime() >= today.getTime() : false;
    });
    const cycleCountToday = (await this.cycleCountRepo.find()).filter(cc =>
      cc.status === CycleCountTaskStatus.RECONCILED &&
      cc.updated_at ? new Date(cc.updated_at).getTime() >= today.getTime() : false
    );
    const receivingsToday = (await this.receivingRepo.find()).filter(rd => {
      const pivot = rd.completed_at || rd.started_at || rd.created_at;
      return pivot ? new Date(pivot).getTime() >= today.getTime() : false;
    });
    const skartToday = (await this.skartRepo.find()).filter(sd =>
      sd.status === SkartStatus.RECEIVED &&
      sd.received_at ? new Date(sd.received_at).getTime() >= today.getTime() : false
    );
    const povracajToday = (await this.povracajRepo.find()).filter(pd =>
      pd.status === PovracajStatus.RECEIVED &&
      pd.received_at ? new Date(pd.received_at).getTime() >= today.getTime() : false
    );

    const countByHour = (dates: (Date | null | undefined)[]) => {
      const map = new Map<number, number>();
      dates.forEach(dt => {
        if (!dt) return;
        const hour = new Date(dt).getHours();
        map.set(hour, (map.get(hour) || 0) + 1);
      });
      return map;
    };

    const putawayMap = countByHour(putawayToday.map(pt => pt.completed_at));
    const pickMap = countByHour(
      shippingToday.map(so => so.closed_at || so.loaded_at || so.staged_at || so.started_at || null)
    );
    const popisMap = countByHour(cycleCountToday.map(cc => cc.updated_at));
    const prijemMap = countByHour(
      receivingsToday.map(rd => rd.completed_at || rd.started_at || rd.created_at || null)
    );
    const skartMap = countByHour(skartToday.map(sd => sd.received_at || null));
    const povracajMap = countByHour(povracajToday.map(pd => pd.received_at || null));

    return hours.map(hour => ({
      hour,
      putaway: putawayMap.get(hour) || 0,
      pick: pickMap.get(hour) || 0,
      popis: popisMap.get(hour) || 0,
      prijem: prijemMap.get(hour) || 0,
      skart: skartMap.get(hour) || 0,
      povracaj: povracajMap.get(hour) || 0,
    }));
    } catch (error: any) {
      console.error('KPI getTimeline error:', error);
      // Return empty timeline on error
      return Array.from({ length: 13 }, (_, i) => ({
        hour: i + 7,
        putaway: 0,
        pick: 0,
        popis: 0,
        prijem: 0,
        skart: 0,
        povracaj: 0,
      }));
    }
  }
}

