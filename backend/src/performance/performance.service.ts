import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PerformanceOverviewDto, PerformanceTeamDto, PerformanceWorkerDto, WorkerSplitDto } from './dto/performance-overview.dto';
import { User } from '../entities/user.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { EventEmitter } from 'events';

@Injectable()
export class PerformanceService implements OnModuleInit, OnModuleDestroy {
  private cache: PerformanceOverviewDto | null = null;
  private timer: any = null;
  private readonly emitter = new EventEmitter();
  private readonly intervalSec = parseInt(process.env.PERFORMANCE_REFRESH_INTERVAL || '30', 10);
  private refreshPromise: Promise<void> | null = null;
  private refreshQueued = false;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TaskAssignee) private taRepo: Repository<TaskAssignee>,
    @InjectRepository(ReceivingItem) private riRepo: Repository<ReceivingItem>,
    @InjectRepository(ReceivingDocument) private rdRepo: Repository<ReceivingDocument>,
    @InjectRepository(ShippingOrder) private soRepo: Repository<ShippingOrder>,
    @InjectRepository(ShippingOrderLine) private solRepo: Repository<ShippingOrderLine>,
    @InjectRepository(InventoryMovement) private mvRepo: Repository<InventoryMovement>,
    @InjectRepository(Team) private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private memberRepo: Repository<TeamMember>,
    @InjectRepository(TaskAssignmentInfo) private assignInfoRepo: Repository<TaskAssignmentInfo>,
  ) {}

  onModuleInit() {
    // Prime cache and schedule periodic refresh
    this.triggerRefresh('module-init').catch(()=>{});
    this.timer = setInterval(() => this.triggerRefresh('interval').catch(()=>{}), this.intervalSec * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  onUpdate(cb: (snap: PerformanceOverviewDto) => void) {
    this.emitter.on('update', cb);
    return () => this.emitter.off('update', cb);
  }

  async getOverview(): Promise<PerformanceOverviewDto> {
    if (!this.cache) {
      await this.triggerRefresh('cache-miss').catch(()=>{});
    }
    return this.cache;
  }

  async triggerRefresh(reason?: string): Promise<void> {
    if (this.refreshPromise) {
      this.refreshQueued = true;
      await this.refreshPromise.catch(() => undefined);
      if (this.refreshQueued) {
        this.refreshQueued = false;
        return this.triggerRefresh(reason);
      }
      return;
    }
    this.refreshPromise = this.refresh()
      .catch(() => undefined)
      .finally(() => {
        this.refreshPromise = null;
      });
    await this.refreshPromise;
    if (this.refreshQueued) {
      this.refreshQueued = false;
      await this.triggerRefresh(reason);
    }
  }

  private async refresh() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const workers = await this.buildWorkers(monthStart);
    const teams = await this.buildTeams(monthStart);
    this.cache = {
      workers,
      teams,
      refresh_interval: this.intervalSec,
      server_time: now.toISOString(),
    };
    this.emitter.emit('update', this.cache);
  }

  private async buildWorkers(monthStart: Date): Promise<PerformanceWorkerDto[]> {
    // Users with role worker types; default team "Picking"
    const users = await this.userRepo.find();
    if (!users || users.length === 0) return [];
    // SAMO magacioneri: filtriramo po ulozi
    const onlyWorkers = users.filter(u => String((u as any).role || '').toLowerCase() === 'magacioner');
    if (onlyWorkers.length === 0) return [];

    const monthIso = monthStart.toISOString();
    const creditedShipping = new Set<string>();
    const creditKey = (userId: number, orderId: number) => `${userId}:${orderId}`;

    // Receiving items aggregated by document (current month only)
    const recDocs = await this.rdRepo.createQueryBuilder('d')
      .where('d.created_at >= :month OR (d.completed_at IS NOT NULL AND d.completed_at >= :month)', { month: monthIso })
      .getMany();
    const recDocIds = recDocs.map(d => d.id);
    const recDocSet = new Set(recDocIds);
    const recItems = recDocIds.length ? await this.riRepo.find({ where: { receiving_document_id: In(recDocIds) } }) : [];
    const itemsByDoc = new Map<number, { expected: number; received: number }>();
    for (const it of recItems) {
      const rawId = (it as any).receiving_document_id || (it as any).document_id || (it as any).receivingDocument?.id || (it as any).receivingDocumentId;
      const docId = rawId != null ? Number(rawId) : undefined;
      if (!docId) continue;
      const exp = parseFloat(String((it as any).expected_quantity || 0));
      const rec = parseFloat(String((it as any).received_quantity || 0));
      const cur = itemsByDoc.get(docId) || { expected: 0, received: 0 };
      cur.expected += exp; cur.received += rec; itemsByDoc.set(docId, cur);
    }

    // Shipping items aggregated by order (current month only)
    const shipOrders = await this.soRepo.createQueryBuilder('o')
      .where('o.created_at >= :month OR (o.completed_at IS NOT NULL AND o.completed_at >= :month)', { month: monthIso })
      .getMany();
    const shipOrderIds = shipOrders.map(o => o.id);
    const shipOrderSet = new Set(shipOrderIds);
    const shipLines = shipOrderIds.length
      ? await this.solRepo.createQueryBuilder('l')
          .leftJoinAndSelect('l.order', 'order')
          .where('order.id IN (:...ids)', { ids: shipOrderIds })
          .getMany()
      : [];
    const itemsByOrder = new Map<number, { requested: number; picked: number }>();
    for (const ln of shipLines) {
      const rawOrderId = (ln as any).shipping_order_id || (ln as any).order_id || (ln as any).orderId || (ln as any).order?.id;
      const orderId = rawOrderId != null ? Number(rawOrderId) : undefined;
      if (!orderId) continue;
      const req = parseFloat(String((ln as any).requested_qty || (ln as any).requested || 0));
      const pic = parseFloat(String((ln as any).picked_qty || (ln as any).picked || 0));
      const cur = itemsByOrder.get(orderId) || { requested: 0, picked: 0 };
      cur.requested += req; cur.picked += pic; itemsByOrder.set(orderId, cur);
    }

    const byUser = new Map<number, PerformanceWorkerDto>();
    for (const u of onlyWorkers) {
      byUser.set(u.id, {
        name: (u as any).full_name || (u as any).username || `User ${u.id}`,
        team: (u as any).team || 'Picking',
        shift: (u as any).shift || null,
        receiving: { box_assigned: 0, box_completed: 0, items_assigned: 0, items_completed: 0 },
        shipping:  { box_assigned: 0, box_completed: 0, items_assigned: 0, items_completed: 0 },
      });
    }

    // Team-aware aggregation: credit documents/items to all assignees when a team completes
    const infos = await this.assignInfoRepo.createQueryBuilder('i')
      .where("i.task_type IN ('RECEIVING','SHIPPING')")
      .getMany();

    const allAssignees = await this.taRepo.createQueryBuilder('a')
      .where("a.task_type IN ('RECEIVING','SHIPPING')")
      .getMany();
    const assigneesMap = new Map<number, TaskAssignee[]>();
    allAssignees.forEach(a => {
      const arr = assigneesMap.get(a.task_id) || [];
      arr.push(a);
      assigneesMap.set(a.task_id, arr);
    });

    for (const info of infos) {
      const type = (info as any).task_type as 'RECEIVING'|'SHIPPING';
      const taskId = (info as any).task_id as number;
      const policy = String((info as any).policy || 'ANY_DONE');
      const assignees = assigneesMap.get(taskId) || [];
      if (!assignees.length) continue;
      if (type === 'RECEIVING' && !recDocSet.has(taskId)) continue;
      if (type === 'SHIPPING' && !shipOrderSet.has(taskId)) continue;
      const anyDone = assignees.some(a => (a as any).status === 'DONE');
      const allDone = assignees.every(a => (a as any).status === 'DONE');
      const teamComplete = policy === 'ALL_DONE' ? allDone : anyDone;

      // Determine totals for this task
      const recAgg = type === 'RECEIVING' ? itemsByDoc.get(taskId) : undefined;
      const shipAgg = type === 'SHIPPING' ? itemsByOrder.get(taskId) : undefined;

      for (const a of assignees) {
        const userEntry = byUser.get(a.user_id);
        if (!userEntry) continue;
        if (type === 'RECEIVING') {
          userEntry.receiving.box_assigned += 1;
          if (recAgg) {
            userEntry.receiving.items_assigned += recAgg.expected;
            userEntry.receiving.items_completed += recAgg.received;
          }
          if (teamComplete) {
            userEntry.receiving.box_completed += 1;
          }
        } else if (type === 'SHIPPING') {
          if (!shipOrderSet.has(taskId)) continue;
          userEntry.shipping.box_assigned += 1;
          if (shipAgg) {
            userEntry.shipping.items_assigned += shipAgg.requested;
            userEntry.shipping.items_completed += shipAgg.picked;
          }
          if (teamComplete) {
            userEntry.shipping.box_completed += 1;
          }
          creditedShipping.add(creditKey(a.user_id, taskId));
        }
      }
    }

    // Fallback: credit directly assigned shipping orders when no task info/assignee covered the user
    for (const order of shipOrders) {
      const assignedUserId = (order as any).assigned_user_id || (order as any).assigned_user?.id || null;
      if (!assignedUserId) continue;
      const shipAgg = itemsByOrder.get(order.id);
      if (!shipAgg) continue;
      const status = String((order as any).status || '').toUpperCase();
      const alreadyCredited = creditedShipping.has(creditKey(assignedUserId, order.id));
      if (alreadyCredited) continue;
      const userEntry = byUser.get(assignedUserId);
      if (!userEntry) continue;
      userEntry.shipping.box_assigned += 1;
      userEntry.shipping.items_assigned += shipAgg.requested;
      if (status === 'CLOSED' || status === 'LOADED' || status === 'COMPLETED') {
        userEntry.shipping.box_completed += 1;
        userEntry.shipping.items_completed += shipAgg.picked;
      }
    }

    return Array.from(byUser.values());
  }

  private async buildTeams(monthStart: Date): Promise<PerformanceTeamDto[]> {
    // Agregacija po stvarnim timovima koristeći TaskAssignmentInfo.team_id
    // Računamo rezultate za RECEIVING i SHIPPING, a Forklift izostavljamo
    const infos = await this.assignInfoRepo.createQueryBuilder('i')
      .where('i.team_id IS NOT NULL')
      .andWhere("i.task_type IN ('RECEIVING','SHIPPING')")
      .getMany();
    if (!infos.length) return [];

    const monthIso = monthStart.toISOString();

    const teamIds = Array.from(new Set(infos.map(i => i.team_id).filter(Boolean)));
    const teams = await this.teamRepo.findByIds(teamIds);
    const teamName = new Map<number, string>();
    teams.forEach(t => teamName.set(t.id, (t as any).name || `Tim ${t.id}`));

    const membersRows = await this.memberRepo.createQueryBuilder('m')
      .where('m.team_id IN (:...ids)', { ids: teamIds })
      .getMany();
    const membersByTeam = new Map<number, number[]>();
    membersRows.forEach(m => {
      const arr = membersByTeam.get(m.team_id) || [];
      arr.push(m.user_id);
      membersByTeam.set(m.team_id, arr);
    });
    // Resolve user names for member lists
    const allMemberIds = Array.from(new Set(membersRows.map(m => m.user_id)));
    const users = allMemberIds.length ? await this.userRepo.createQueryBuilder('u').where('u.id IN (:...ids)', { ids: allMemberIds }).getMany() : [];
    const nameById = new Map<number,string>();
    users.forEach(u => nameById.set(u.id, (u as any).full_name || (u as any).name || u.username));

    // Prepare item aggregations
    const recDocs = await this.rdRepo.createQueryBuilder('d')
      .where('d.created_at >= :month OR (d.completed_at IS NOT NULL AND d.completed_at >= :month)', { month: monthIso })
      .getMany();
    const recDocIds = recDocs.map(d => d.id);
    const recDocSet = new Set(recDocIds);
    const recItems = recDocIds.length ? await this.riRepo.find({ where: { receiving_document_id: In(recDocIds) } }) : [];
    const itemsByDoc = new Map<number, { expected: number; received: number }>();
    for (const it of recItems) {
      const rawId = (it as any).receiving_document_id || (it as any).document_id || (it as any).receivingDocument?.id || (it as any).receivingDocumentId;
      const docId = rawId != null ? Number(rawId) : undefined;
      if (!docId) continue;
      const exp = parseFloat(String((it as any).expected_quantity || 0));
      const rec = parseFloat(String((it as any).received_quantity || 0));
      const cur = itemsByDoc.get(docId) || { expected: 0, received: 0 };
      cur.expected += exp; cur.received += rec; itemsByDoc.set(docId, cur);
    }
    const shipOrders = await this.soRepo.createQueryBuilder('o')
      .where('o.created_at >= :month OR (o.completed_at IS NOT NULL AND o.completed_at >= :month)', { month: monthIso })
      .getMany();
    const shipOrderIds = shipOrders.map(o => o.id);
    const shipOrderSet = new Set(shipOrderIds);
    const shipLines = shipOrderIds.length
      ? await this.solRepo.createQueryBuilder('l')
          .leftJoinAndSelect('l.order', 'order')
          .where('order.id IN (:...ids)', { ids: shipOrderIds })
          .getMany()
      : [];
    const itemsByOrder = new Map<number, { requested: number; picked: number }>();
    for (const ln of shipLines) {
      const rawOrderId = (ln as any).shipping_order_id || (ln as any).order_id || (ln as any).orderId || (ln as any).order?.id;
      const orderId = rawOrderId != null ? Number(rawOrderId) : undefined;
      if (!orderId) continue;
      const req = parseFloat(String((ln as any).requested_qty || (ln as any).requested || 0));
      const pic = parseFloat(String((ln as any).picked_qty || (ln as any).picked || 0));
      const cur = itemsByOrder.get(orderId) || { requested: 0, picked: 0 };
      cur.requested += req; cur.picked += pic; itemsByOrder.set(orderId, cur);
    }

    const recStatus = new Map<number,string>();
    recDocs.forEach(d => recStatus.set(d.id, (d as any).status));
    const shipStatus = new Map<number,string>();
    shipOrders.forEach(o => shipStatus.set(o.id, (o as any).status));

    const agg = new Map<number, { rec:{box:number;done:number;items:number;itemsDone:number}; ship:{box:number;done:number;items:number;itemsDone:number} }>();
    for (const i of infos) {
      const tid = Number(i.team_id);
      const a = agg.get(tid) || { rec:{box:0,done:0,items:0,itemsDone:0}, ship:{box:0,done:0,items:0,itemsDone:0} };
      if (i.task_type === 'RECEIVING') {
        if (!recDocSet.has(i.task_id)) continue;
        a.rec.box += 1;
        const st = recStatus.get(i.task_id) || '';
        if (st === 'completed') a.rec.done += 1;
        const it = itemsByDoc.get(i.task_id);
        if (it) { a.rec.items += it.expected; a.rec.itemsDone += it.received; }
      } else if (i.task_type === 'SHIPPING') {
        if (!shipOrderSet.has(i.task_id)) continue;
        a.ship.box += 1;
        const st = shipStatus.get(i.task_id) || '';
        if (st === 'CLOSED' || st === 'LOADED') a.ship.done += 1;
        const it = itemsByOrder.get(i.task_id);
        if (it) { a.ship.items += it.requested; a.ship.itemsDone += it.picked; }
      }
      agg.set(tid, a);
    }

    const out: PerformanceTeamDto[] = [];
    agg.forEach((v, tid) => {
      const name = teamName.get(tid) || `Tim ${tid}`;
      const memberIds = membersByTeam.get(tid) || [];
      const memberNames = memberIds.map(id => nameById.get(id) || `#${id}`);
      out.push({
        team: name,
        team_id: tid,
        members_names: memberNames,
        // split metrics used by TV
        receiving: {
          box_assigned: v.rec.box,
          box_completed: v.rec.done,
          items_assigned: v.rec.items,
          items_completed: v.rec.itemsDone,
        },
        shipping: {
          box_assigned: v.ship.box,
          box_completed: v.ship.done,
          items_assigned: v.ship.items,
          items_completed: v.ship.itemsDone,
        },
        // legacy combined fields for backward compatibility
        box_assigned: v.ship.box + v.rec.box,
        box_completed: v.ship.done + v.rec.done,
        invoices_completed: v.ship.done,
        sku_completed: v.ship.itemsDone,
      });
    });
    return out;
  }
}
