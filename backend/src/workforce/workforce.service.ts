import { Injectable, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { Supplier } from '../entities/supplier.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { AnalyticsPushService } from '../analytics/analytics-push.service';
import { AssignmentsGateway } from './assignments.gateway';
import { SkartDocument, SkartStatus } from '../skart/entities/skart-document.entity';
import { PovracajDocument, PovracajStatus } from '../povracaj/entities/povracaj-document.entity';

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class WorkforceService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserShift) private readonly shiftRepo: Repository<UserShift>,
    @InjectRepository(ReceivingDocument) private readonly docRepo: Repository<ReceivingDocument>,
    @InjectRepository(ReceivingItem) private readonly itemRepo: Repository<ReceivingItem>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(require('../cycle-count/cycle-count-task.entity').CycleCountTask) private readonly ccTaskRepo: Repository<any>,
    @InjectRepository(PutawayTask) private readonly putawayRepo: Repository<PutawayTask>,
    @InjectRepository(ShippingOrder) private readonly shippingRepo: Repository<ShippingOrder>,
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private readonly memberRepo: Repository<TeamMember>,
    @InjectRepository(TaskAssignee) private readonly assignRepo: Repository<TaskAssignee>,
    @InjectRepository(TaskAssignmentInfo) private readonly assignInfoRepo: Repository<TaskAssignmentInfo>,
    @InjectRepository(SkartDocument) private readonly skartRepo: Repository<SkartDocument>,
    @InjectRepository(PovracajDocument) private readonly povracajRepo: Repository<PovracajDocument>,
    private readonly analyticsPush: AnalyticsPushService,
    // websocket announcements (optional)
    @Optional() private readonly assignmentsWs?: AssignmentsGateway,
    // Optional: reuse Performance service to avoid duplication if needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // private readonly perf?: import('../performance/performance.service').PerformanceService,
  ) {}

  private ensureSupervisor(role: string) {
    const normalizedRole = (role || '').toLowerCase();
    if (!['admin', 'sef_magacina', 'menadzer', 'sef', 'logistika'].includes(normalizedRole)) {
      throw new ForbiddenException('Pristup dozvoljen samo admin/šef magacina/menadžer/šef/logistika.');
    }
  }

  // Assign a task to users or a team.
  async assignTask(actor: { id: number; role: string }, body: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'|'SKART'|'POVRACAJ'; task_id: number; assignees?: number[]; team_id?: number; policy?: 'ANY_DONE'|'ALL_DONE' }) {
    this.ensureSupervisor(actor.role);
    if (!body || !body.type || !body.task_id) throw new BadRequestException('Nedostaju parametri');
    let userIds: number[] = Array.isArray(body.assignees) ? body.assignees.map(Number).filter(Boolean) : [];
    if (body.team_id) {
      const members = await this.memberRepo.find({ where: { team_id: body.team_id, is_active: true } as any });
      if (!members.length) {
        throw new BadRequestException('Tim nema aktivnih članova');
      }
      const ids = members.map(m => m.user_id);
      userIds = Array.from(new Set([...(userIds || []), ...ids]));
    }
    if (!userIds.length) throw new BadRequestException('Nisu izabrani korisnici ni tim');

    // Ensure users exist
    // Resolve valid users using IN(...) to avoid ORM ambiguity on arrays
    const { In } = require('typeorm');
    const users = await this.userRepo.find({ where: { id: In(userIds as any) } });
    const valid = new Set(users.map(u => u.id));
    userIds = userIds.filter(id => valid.has(id));
    if (!userIds.length) throw new BadRequestException('Nevažeći korisnici');

    // Clear previous assignees for this task
    await this.assignRepo.delete({ task_type: body.type as any, task_id: body.task_id } as any);
    const rows = userIds.map(uid => this.assignRepo.create({ task_type: body.type as any, task_id: body.task_id, user_id: uid, status: 'ASSIGNED' }));
    await this.assignRepo.save(rows);

    // Upsert assignment info (policy + optional team)
    const existing = await this.assignInfoRepo.findOne({ where: { task_type: body.type as any, task_id: body.task_id } as any });
    const policy = (body.policy === 'ALL_DONE' ? 'ALL_DONE' : 'ANY_DONE') as any;
    if (!existing) {
      const info = this.assignInfoRepo.create({ task_type: body.type as any, task_id: body.task_id, policy, team_id: body.team_id || null, created_by_user_id: actor.id });
      await this.assignInfoRepo.save(info);
    } else {
      existing.policy = policy;
      (existing as any).team_id = body.team_id || null;
      await this.assignInfoRepo.save(existing);
    }

    // Auto-start for worker UX (no manual accept)
    const now = new Date();
    try {
      if (body.type === 'RECEIVING') {
        // Mark receiving document IN_PROGRESS if not already
        const doc = await this.docRepo.findOne({ where: { id: body.task_id } as any });
        if (doc) {
          const cur = String((doc as any).status || '').toLowerCase();
          if (cur !== 'in_progress' && cur !== 'completed') {
            (doc as any).status = 'in_progress';
            if (!(doc as any).started_at) (doc as any).started_at = now as any;
            await this.docRepo.save(doc);
          }
        }
      } else if (body.type === 'SHIPPING') {
        // Optionally move shipping order to PICKING (non-invasive if already in progress)
        const so = await this.shippingRepo.findOne({ where: { id: body.task_id } as any });
        if (so) {
          const cur = String((so as any).status || '').toUpperCase();
          if (cur !== 'PICKING' && cur !== 'STAGED' && cur !== 'LOADED' && cur !== 'CLOSED') {
            (so as any).status = 'PICKING';
            if (!(so as any).started_at) (so as any).started_at = now as any;
            await this.shippingRepo.save(so);
          }
        }
      }
      // Mark all assignees as IN_PROGRESS immediately so they appear in "my-active"
      await this.assignRepo.createQueryBuilder()
        .update()
        .set({ status: 'IN_PROGRESS' as any, started_at: now as any })
        .where("task_type = :t AND task_id = :id", { t: body.type as any, id: body.task_id })
        .execute();
    } catch {}

    // Notify via WS (real-time banner for PWA)
    try {
      this.assignmentsWs?.broadcastNewAssignment({
        type: body.type,
        task_id: body.task_id,
        team_id: body.team_id || null,
        assignees: userIds,
      });
    } catch {}

    // Backward-compat: set primary single assignee on the task
    const primary = userIds[0];
    try {
      if (body.type === 'RECEIVING') {
        const doc = await this.docRepo.findOne({ where: { id: body.task_id } as any });
        if (doc) {
          (doc as any).assigned_to = primary;
          await this.docRepo.save(doc);
        }
      } else if (body.type === 'PUTAWAY') {
        const pt = await this.putawayRepo.findOne({ where: { id: body.task_id } as any });
        if (pt) {
          (pt as any).assigned_user = { id: primary } as any;
          await this.putawayRepo.save(pt);
        }
      } else if (body.type === 'SHIPPING') {
        const so = await this.shippingRepo.findOne({ where: { id: body.task_id } as any });
        if (so) {
          (so as any).assigned_user = { id: primary } as any;
          await this.shippingRepo.save(so);
        }
      } else if (body.type === 'SKART') {
        // For SKART, assign to primary user (first team member)
        const skartDoc = await this.skartRepo.findOne({ where: { id: body.task_id } as any });
        if (skartDoc) {
          skartDoc.assigned_to_user_id = primary;
          await this.skartRepo.save(skartDoc);
        }
      } else if (body.type === 'POVRACAJ') {
        // For POVRACAJ, assign to primary user (first team member)
        const povracajDoc = await this.povracajRepo.findOne({ where: { id: body.task_id } as any });
        if (povracajDoc) {
          povracajDoc.assigned_to_user_id = primary;
          await this.povracajRepo.save(povracajDoc);
        }
      }
    } catch (e) {
      // Ignore best-effort updates to legacy columns
    }

    return { ok: true, assigned_count: userIds.length };
  }

  async assigneeStart(actor: { id: number; role: string }, assigneeId: number) {
    // Any authenticated worker can start their own assignment; supervisors can start any
    const row = await this.assignRepo.findOne({ where: { id: assigneeId } as any });
    if (!row) throw new BadRequestException('Zadatak nije pronađen');
    if (!['admin','sef_magacina','menadzer'].includes(actor.role) && row.user_id !== actor.id) {
      throw new ForbiddenException('Nije dozvoljeno');
    }
    row.status = 'IN_PROGRESS' as any;
    row.started_at = new Date();
    await this.assignRepo.save(row);
    // fire-and-forget push
    this.analyticsPush.pushAssigneeRow(row.id).catch(()=>{});
    return { ok: true };
  }

  async assigneeComplete(actor: { id: number; role: string }, assigneeId: number) {
    const row = await this.assignRepo.findOne({ where: { id: assigneeId } as any });
    if (!row) throw new BadRequestException('Zadatak nije pronađen');
    if (!['admin','sef_magacina','menadzer'].includes(actor.role) && row.user_id !== actor.id) {
      throw new ForbiddenException('Nije dozvoljeno');
    }
    row.status = 'DONE' as any;
    row.completed_at = new Date();
    await this.assignRepo.save(row);
    // fire-and-forget push
    this.analyticsPush.pushAssigneeRow(row.id).catch(()=>{});
    // Evaluate completion policy to optionally close the main task
    const info = await this.assignInfoRepo.findOne({ where: { task_type: row.task_type as any, task_id: row.task_id } as any });
    if (info && info.policy === 'ANY_DONE') {
      // No action to underlying entities to avoid changing business logic here; analytics use TaskAssignee
    } else if (info && info.policy === 'ALL_DONE') {
      const remaining = await this.assignRepo.count({ where: { task_type: row.task_type as any, task_id: row.task_id, status: 'ASSIGNED' } as any });
      const inprog = await this.assignRepo.count({ where: { task_type: row.task_type as any, task_id: row.task_id, status: 'IN_PROGRESS' } as any });
      if (remaining + inprog === 0) {
        // All assignees done. Mark non-invasive state and log.
        try {
          info.all_done_at = new Date() as any;
          await this.assignInfoRepo.save(info);
          console.log(`[ALL_DONE] ${row.task_type}#${row.task_id} completed by team at ${info.all_done_at?.toISOString?.()}`);
        } catch {}
      }
    }
    return { ok: true };
  }

  async listTaskAssignees(type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'|'SKART'|'POVRACAJ', taskId: number) {
    const rows = await this.assignRepo.find({ where: { task_type: type as any, task_id: taskId } as any });
    const info = await this.assignInfoRepo.findOne({ where: { task_type: type as any, task_id: taskId } as any });
    return { policy: info?.policy || 'ANY_DONE', team_id: info?.team_id || null, all_done_at: (info as any)?.all_done_at || null, assignees: rows.map(r => ({ id: r.id, user_id: r.user_id, user_name: (r.user as any)?.name || (r.user as any)?.full_name || (r.user as any)?.username || String(r.user_id), status: r.status, started_at: r.started_at, completed_at: r.completed_at })) };
  }

  async analyticsSummary(from?: string, to?: string) {
    const since = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const until = to ? new Date(to) : new Date();
    const rows = await this.assignRepo.createQueryBuilder('a')
      .select('a.user_id', 'user_id')
      .addSelect('a.task_type', 'task_type')
      .addSelect('COUNT(*)', 'cnt')
      .where("a.status = 'DONE'")
      .andWhere('a.completed_at BETWEEN :since AND :until', { since, until })
      .groupBy('a.user_id')
      .addGroupBy('a.task_type')
      .getRawMany();
    const byUser = new Map<number, any>();
    for (const r of rows) {
      const uid = Number(r.user_id);
      const tp = String(r.task_type) as any;
      const cnt = Number(r.cnt);
      const obj = byUser.get(uid) || { user_id: uid, RECEIVING: 0, SHIPPING: 0, PUTAWAY: 0, SKART: 0, POVRACAJ: 0, TOTAL: 0 };
      obj[tp] = (obj[tp] || 0) + cnt;
      obj.TOTAL += cnt;
      byUser.set(uid, obj);
    }
    // Add SKART statistics from SkartDocument (RECEIVED status, received_by in date range)
    const skartRows = await this.skartRepo.createQueryBuilder('sd')
      .select('sd.received_by', 'user_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('sd.status = :status', { status: SkartStatus.RECEIVED })
      .andWhere('sd.received_by IS NOT NULL')
      .andWhere('sd.received_at BETWEEN :since AND :until', { since, until })
      .groupBy('sd.received_by')
      .getRawMany();
    for (const r of skartRows) {
      const uid = Number(r.user_id);
      const cnt = Number(r.cnt);
      const obj = byUser.get(uid) || { user_id: uid, RECEIVING: 0, SHIPPING: 0, PUTAWAY: 0, SKART: 0, POVRACAJ: 0, TOTAL: 0 };
      obj.SKART = (obj.SKART || 0) + cnt;
      obj.TOTAL += cnt;
      byUser.set(uid, obj);
    }
    // Add Povraćaj statistics from PovracajDocument (RECEIVED status, received_by in date range)
    const povracajRows = await this.povracajRepo.createQueryBuilder('pd')
      .select('pd.received_by', 'user_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('pd.status = :status', { status: PovracajStatus.RECEIVED })
      .andWhere('pd.received_by IS NOT NULL')
      .andWhere('pd.received_at BETWEEN :since AND :until', { since, until })
      .groupBy('pd.received_by')
      .getRawMany();
    for (const r of povracajRows) {
      const uid = Number(r.user_id);
      const cnt = Number(r.cnt);
      const obj = byUser.get(uid) || { user_id: uid, RECEIVING: 0, SHIPPING: 0, PUTAWAY: 0, SKART: 0, POVRACAJ: 0, TOTAL: 0 };
      obj.POVRACAJ = (obj.POVRACAJ || 0) + cnt;
      obj.TOTAL += cnt;
      byUser.set(uid, obj);
    }
    // Attach user names
    const ids = Array.from(byUser.keys());
    if (ids.length) {
      const users = await this.userRepo.findByIds(ids as any);
      const nmap = new Map(users.map(u => [u.id, (u as any).name || u.username]));
      for (const v of byUser.values()) {
        v.user_name = nmap.get(v.user_id) || String(v.user_id);
      }
    }
    return Array.from(byUser.values());
  }

  async analyticsFacts(from?: string, to?: string) {
    const since = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const until = to ? new Date(to) : new Date();
    // Pull DONE rows with user info and optional assignment info (policy/team)
    const rows = await this.assignRepo.createQueryBuilder('a')
      .leftJoin(TaskAssignmentInfo, 'i', 'i.task_type = a.task_type AND i.task_id = a.task_id')
      .leftJoin(User, 'u', 'u.id = a.user_id')
      .leftJoin(ReceivingDocument, 'd', "d.id = a.task_id AND a.task_type = 'RECEIVING'")
      .leftJoin(ShippingOrder, 'so', "so.id = a.task_id AND a.task_type = 'SHIPPING'")
      .leftJoin(PutawayTask, 'pt', "pt.id = a.task_id AND a.task_type = 'PUTAWAY'")
      .leftJoin(SkartDocument, 'sd', "sd.id = a.task_id AND a.task_type = 'SKART'")
      .leftJoin(PovracajDocument, 'pd', "pd.id = a.task_id AND a.task_type = 'POVRACAJ'")
      .select('a.id', 'assignee_id')
      .addSelect('a.task_type', 'task_type')
      .addSelect('a.task_id', 'task_id')
      .addSelect('a.user_id', 'user_id')
      .addSelect("COALESCE(u.name, u.username)", 'user_name')
      .addSelect('a.started_at', 'started_at')
      .addSelect('a.completed_at', 'completed_at')
      .addSelect('a.status', 'status')
      .addSelect('i.policy', 'policy')
      .addSelect('i.team_id', 'team_id')
      .addSelect('d.document_number', 'document_number')
      .addSelect('so.order_number', 'order_number')
      .addSelect('pt.pallet_id', 'pallet_id')
      .addSelect('sd.uid', 'skart_uid')
      .addSelect('pd.uid', 'povracaj_uid')
      .where("a.status IN ('DONE','IN_PROGRESS')")
      .andWhere('COALESCE(a.completed_at, a.started_at) BETWEEN :since AND :until', { since, until })
      .orderBy('COALESCE(a.completed_at, a.started_at)', 'ASC')
      .getRawMany();
    // Map skart_uid and povracaj_uid to document_number for consistency
    return rows.map((r: any) => {
      if (r.task_type === 'SKART' && r.skart_uid) {
        r.document_number = r.skart_uid;
      } else if (r.task_type === 'POVRACAJ' && r.povracaj_uid) {
        r.document_number = r.povracaj_uid;
      }
      return r;
    });
  }

  async analyticsFactsByType(type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'|'SKART'|'POVRACAJ', from?: string, to?: string) {
    const since = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const until = to ? new Date(to) : new Date();
    const qb = this.assignRepo.createQueryBuilder('a')
      .leftJoin(TaskAssignmentInfo, 'i', 'i.task_type = a.task_type AND i.task_id = a.task_id')
      .leftJoin(User, 'u', 'u.id = a.user_id')
      .leftJoin(ReceivingDocument, 'd', "d.id = a.task_id AND a.task_type = 'RECEIVING'")
      .leftJoin(ShippingOrder, 'so', "so.id = a.task_id AND a.task_type = 'SHIPPING'")
      .leftJoin(PutawayTask, 'pt', "pt.id = a.task_id AND a.task_type = 'PUTAWAY'")
      .leftJoin(SkartDocument, 'sd', "sd.id = a.task_id AND a.task_type = 'SKART'")
      .leftJoin(PovracajDocument, 'pd', "pd.id = a.task_id AND a.task_type = 'POVRACAJ'")
      .select('a.id', 'assignee_id')
      .addSelect('a.task_type', 'task_type')
      .addSelect('a.task_id', 'task_id')
      .addSelect('a.user_id', 'user_id')
      .addSelect("COALESCE(u.name, u.username)", 'user_name')
      .addSelect('a.started_at', 'started_at')
      .addSelect('a.completed_at', 'completed_at')
      .addSelect('a.status', 'status')
      .addSelect('i.policy', 'policy')
      .addSelect('i.team_id', 'team_id')
      .addSelect('d.document_number', 'document_number')
      .addSelect('so.order_number', 'order_number')
      .addSelect('pt.pallet_id', 'pallet_id')
      .addSelect('sd.uid', 'skart_uid')
      .addSelect('pd.uid', 'povracaj_uid')
      .where("a.status IN ('DONE','IN_PROGRESS')")
      .andWhere('COALESCE(a.completed_at, a.started_at) BETWEEN :since AND :until', { since, until })
      .andWhere('a.task_type = :tp', { tp: type })
      .orderBy('COALESCE(a.completed_at, a.started_at)', 'ASC');
    const rows = await qb.getRawMany();
    // Map skart_uid and povracaj_uid to document_number for consistency
    return rows.map((r: any) => {
      if (r.task_type === 'SKART' && r.skart_uid) {
        r.document_number = r.skart_uid;
      } else if (r.task_type === 'POVRACAJ' && r.povracaj_uid) {
        r.document_number = r.povracaj_uid;
      }
      return r;
    });
  }

  async overview(actorRole: string) {
    this.ensureSupervisor(actorRole);
    const today = todayDateString();

    const workers = await this.userRepo.find({ where: { role: 'magacioner' as any } });
    const workerIds = workers.map(w => w.id);

    // Map shifts for today
    const shifts = await this.shiftRepo.find({ where: { shift_date: today } as any });
    const shiftMap = new Map<number, string>();
    shifts.forEach(s => shiftMap.set(s.user_id, s.shift_type));

    // Active docs for these users
    const docs = await this.docRepo
      .createQueryBuilder('d')
      .leftJoinAndMapOne('d.supplier', Supplier, 's', 's.id = d.supplier_id')
      .where(workerIds.length ? 'd.assigned_to IN (:...ids)' : '1=0', { ids: workerIds })
      .andWhere(new Brackets(qb => {
        qb.where('d.status IN (:...active)', { active: [ReceivingStatus.IN_PROGRESS, ReceivingStatus.ON_HOLD] })
          .orWhere('d.status = :draftStatus', { draftStatus: ReceivingStatus.DRAFT });
      }))
      .getMany();

    const docIds = docs.map(d => d.id);
    const docIdSet = new Set(docIds);

    // Preload items per document for aggregates
    const items = docIds.length ? await this.itemRepo
      .createQueryBuilder('it')
      .where('it.receiving_document_id IN (:...docIds)', { docIds })
      .getMany() : [];
    const itemsByDoc = new Map<number, ReceivingItem[]>();
    items.forEach(it => {
      const arr = itemsByDoc.get(it.receiving_document_id) || [];
      arr.push(it);
      itemsByDoc.set(it.receiving_document_id, arr);
    });

    const docsByUser = new Map<number, any[]>();
    for (const d of docs) {
      const its = itemsByDoc.get(d.id) || [];
      const total = its.length || 0;
      const received = its.filter(x => (x.received_quantity || 0) > 0).length;
      const pct = total > 0 ? Math.round((received / total) * 100) : 0;
      const rec = {
        id: d.id,
        document_number: d.document_number,
        status: d.status,
        supplier_name: (d as any).supplier?.name || '',
        percent_complete: pct,
        started_at: d.started_at || d.created_at,
      };
      const arr = docsByUser.get(d.assigned_to) || [];
      arr.push(rec);
      docsByUser.set(d.assigned_to, arr);
    }

    // fill putaway counts per worker
    const putawayTasks = await this.putawayRepo.find({ where: [{ status: 'ASSIGNED' }, { status: 'IN_PROGRESS' }] as any, relations: ['assigned_user'] });
    const putawayByUser = new Map<number, { count: number; oldest: number }>();
    for (const pt of putawayTasks) {
      if (!pt.assigned_user) continue;
      const uid = pt.assigned_user.id;
      const age = Math.floor((Date.now() - new Date(pt.created_at).getTime()) / 60000);
      const existing = putawayByUser.get(uid) || { count: 0, oldest: 0 };
      existing.count++;
      if (age > existing.oldest) existing.oldest = age;
      putawayByUser.set(uid, existing);
    }

    // fill shipping counts per worker (PICKING) with progress
    const shippingList = await this.shippingRepo.find({ where: { status: 'PICKING' } as any, relations: ['assigned_user', 'lines'] });
    const shippingByUser = new Map<number, { count: number; oldest: number; orders: any[] }>();
    for (const so of shippingList) {
      if (!so.assigned_user) continue;
      const uid = so.assigned_user.id;
      const age = so.started_at ? Math.floor((Date.now() - new Date(so.started_at).getTime()) / 60000) : 0;
      const existing = shippingByUser.get(uid) || { count: 0, oldest: 0, orders: [] };
      existing.count++;
      if (age > existing.oldest) existing.oldest = age;
      // Calculate progress for this order
      const lines = (so as any).lines || [];
      const requested = lines.reduce((sum: number, ln: any) => sum + (parseFloat(String(ln.requested_qty || 0)) || 0), 0);
      const picked = lines.reduce((sum: number, ln: any) => sum + (parseFloat(String(ln.picked_qty || 0)) || 0), 0);
      const percent = requested > 0 ? Math.min(100, Math.max(0, Math.round((picked / requested) * 100))) : 0;
      existing.orders.push({
        id: so.id,
        order_number: so.order_number,
        customer_name: so.customer_name,
        status: so.status,
        percent_complete: percent,
        started_at: so.started_at,
      });
      shippingByUser.set(uid, existing);
    }

    // fill SKART counts per worker (SUBMITTED status, assigned to user)
    const skartDocs = workerIds.length ? await this.skartRepo.find({
      where: {
        assigned_to_user_id: In(workerIds),
        status: SkartStatus.SUBMITTED,
      } as any,
      relations: ['store'],
    }) : [];
    const skartByUser = new Map<number, any[]>();
    for (const sd of skartDocs) {
      if (!sd.assigned_to_user_id) continue;
      const uid = sd.assigned_to_user_id;
      const age = Math.floor((Date.now() - new Date(sd.created_at).getTime()) / 60000);
      const arr = skartByUser.get(uid) || [];
      arr.push({
        id: sd.id,
        uid: sd.uid,
        status: sd.status,
        store_name: (sd as any).store?.name || null,
        created_at: sd.created_at,
        age_minutes: age,
      });
      skartByUser.set(uid, arr);
    }

    // fill POVRACAJ counts per worker (SUBMITTED status, assigned to user)
    const povracajDocs = workerIds.length ? await this.povracajRepo.find({
      where: {
        assigned_to_user_id: In(workerIds),
        status: PovracajStatus.SUBMITTED,
      } as any,
      relations: ['store'],
    }) : [];
    const povracajByUser = new Map<number, any[]>();
    for (const pd of povracajDocs) {
      if (!pd.assigned_to_user_id) continue;
      const uid = pd.assigned_to_user_id;
      const age = Math.floor((Date.now() - new Date(pd.created_at).getTime()) / 60000);
      const arr = povracajByUser.get(uid) || [];
      arr.push({
        id: pd.id,
        uid: pd.uid,
        status: pd.status,
        store_name: (pd as any).store?.name || null,
        created_at: pd.created_at,
        age_minutes: age,
      });
      povracajByUser.set(uid, arr);
    }

    // Prefer counts from task_assignees when available (team/multi-assign)
    const aRecv = new Map<number, { count: number; oldest: number }>();
    const aPut = new Map<number, { count: number; oldest: number }>();
    const aShip = new Map<number, { count: number; oldest: number }>();
    const orphanAssignmentIds: number[] = [];
    const orphanTaskIds: Set<number> = new Set();
    if (workerIds.length) {
      const assignRows = await this.assignRepo.createQueryBuilder('a')
        .where('a.user_id IN (:...uids)', { uids: workerIds })
        .andWhere("a.status != 'DONE'")
        .getMany();
      for (const a of assignRows) {
        if ((a as any).task_type === 'RECEIVING' && !docIdSet.has((a as any).task_id)) {
          orphanAssignmentIds.push(a.id);
          if ((a as any).task_id) orphanTaskIds.add(Number((a as any).task_id));
          continue;
        }
        const uid = (a as any).user_id as number;
        const age = a.started_at ? Math.floor((Date.now() - new Date(a.started_at).getTime()) / 60000) : 0;
        const bump = (m: Map<number, { count: number; oldest: number }>) => {
          const ex = m.get(uid) || { count: 0, oldest: 0 };
          ex.count++;
          if (age > ex.oldest) ex.oldest = age;
          m.set(uid, ex);
        };
        if ((a as any).task_type === 'RECEIVING') bump(aRecv);
        else if ((a as any).task_type === 'PUTAWAY') bump(aPut);
        else if ((a as any).task_type === 'SHIPPING') bump(aShip);
      }
    }

    if (orphanAssignmentIds.length) {
      await this.assignRepo.delete(orphanAssignmentIds);
      if (orphanTaskIds.size) {
        await this.assignInfoRepo.delete({ task_type: 'RECEIVING', task_id: In(Array.from(orphanTaskIds)) } as any);
      }
    }

    const now = Date.now();
    const result = workers.map(w => {
      const active = (w.active ?? (w as any).is_active) !== false;
      let online_status = 'OFFLINE';
      if (!active) online_status = 'NEAKTIVAN';
      else if (w.last_activity && (now - new Date(w.last_activity).getTime()) <= 180000) online_status = 'ONLINE';
      const shift_type = shiftMap.get(w.id) || 'NEDODELJEN';
      const active_receivings = docsByUser.get(w.id) || [];
      const putawayInfo = aPut.get(w.id) || putawayByUser.get(w.id) || { count: 0, oldest: 0 };
      const shippingInfo = aShip.get(w.id) || shippingByUser.get(w.id) || { count: 0, oldest: 0, orders: [] };
      const active_skart = skartByUser.get(w.id) || [];
      const active_povracaj = povracajByUser.get(w.id) || [];
      return {
        user_id: w.id,
        full_name: (w as any).full_name || w.name || w.username,
        username: w.username,
        role: w.role,
        shift_type,
        online_status,
        open_tasks_count: (aRecv.get(w.id)?.count ?? active_receivings.length),
        open_putaways: putawayInfo.count,
        oldest_putaway_age: putawayInfo.count > 0 ? putawayInfo.oldest : 0,
        active_receivings,
        last_heartbeat_at: w.last_activity || null,
        open_cycle_counts: 0,
        open_shipping_orders: shippingInfo.count,
        shipping_oldest_age: shippingInfo.oldest,
        active_shipping_orders: (shippingInfo as any).orders || [],
        open_skart_count: active_skart.length,
        active_skart_documents: active_skart,
        open_povracaj_count: active_povracaj.length,
        active_povracaj_documents: active_povracaj,
      };
    });

    // fill open_cycle_counts per worker
    const ids2 = workers.map(w => w.id);
    if (ids2.length && this.ccTaskRepo) {
      const trows = await this.ccTaskRepo.createQueryBuilder('t')
        .select('t.assigned_to_user_id', 'uid')
        .addSelect('COUNT(*)', 'cnt')
        .where('t.assigned_to_user_id IN (:...ids)', { ids: ids2 })
        .andWhere("t.status != 'RECONCILED'")
        .groupBy('t.assigned_to_user_id')
        .getRawMany();
      const map = new Map<number, number>();
      trows.forEach(r => map.set(Number(r.uid), Number(r.cnt)));
      for (const r of result) {
        (r as any).open_cycle_counts = map.get(r.user_id) || 0;
      }
    }

    return result;
  }

  async teamTasks(teamId: number) {
    if (!teamId || Number.isNaN(teamId)) {
      throw new BadRequestException('Neispravan identifikator tima');
    }

    const team = await this.teamRepo.findOne({ where: { id: teamId } as any });
    if (!team) {
      throw new BadRequestException('Tim nije pronađen');
    }

    const infos = await this.assignInfoRepo.find({
      where: { team_id: teamId } as any,
      order: { updated_at: 'DESC' },
    });

    const teamName = (team as any).name || `Tim ${teamId}`;

    const memberRows = await this.memberRepo.createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'u')
      .where('m.team_id = :teamId', { teamId })
      .andWhere('m.is_active = true')
      .getMany();

    const members = memberRows.map(m => ({
      user_id: m.user_id,
      full_name:
        (m as any).user?.full_name ||
        (m as any).user?.name ||
        (m as any).user?.username ||
        `ID ${m.user_id}`,
    }));

    if (!infos.length) {
      return {
        team: { id: teamId, name: teamName },
        members,
        summary: { total: 0, receiving: 0, shipping: 0, skart: 0, povracaj: 0 },
        receiving: [],
        shipping: [],
        skart: [],
        povracaj: [],
      };
    }

    const now = Date.now();

    const recInfos = infos.filter(info => info.task_type === 'RECEIVING');
    const shipInfos = infos.filter(info => info.task_type === 'SHIPPING');

    const recIds = recInfos.map(info => info.task_id);
    const shipIds = shipInfos.map(info => info.task_id);
    
    // Get SKART documents assigned to team members
    const memberUserIds = members.map(m => m.user_id);
    const skartDocs = memberUserIds.length
      ? await this.skartRepo.find({
          where: {
            assigned_to_user_id: In(memberUserIds),
            status: SkartStatus.SUBMITTED,
          } as any,
          relations: ['store'],
        })
      : [];
    
    // Get POVRACAJ documents assigned to team members
    const povracajDocs = memberUserIds.length
      ? await this.povracajRepo.find({
          where: {
            assigned_to_user_id: In(memberUserIds),
            status: PovracajStatus.SUBMITTED,
          } as any,
          relations: ['store'],
        })
      : [];

    const recDocs = recIds.length
      ? await this.docRepo.find({ where: { id: In(recIds) } as any, relations: ['supplier'] })
      : [];
    const shipOrders = shipIds.length
      ? await this.shippingRepo.find({ where: { id: In(shipIds) } as any })
      : [];

    const recItems = recIds.length
      ? await this.itemRepo.find({ where: { receiving_document_id: In(recIds) } as any })
      : [];
    const itemsByDoc = new Map<number, { expected: number; received: number }>();
    for (const item of recItems) {
      const docId = item.receiving_document_id;
      const entry = itemsByDoc.get(docId) || { expected: 0, received: 0 };
      entry.expected += Number(item.expected_quantity || 0);
      entry.received += Number(item.received_quantity || 0);
      itemsByDoc.set(docId, entry);
    }

    const shippingLineRepo = this.shippingRepo.manager.getRepository(ShippingOrderLine);
    const shipLines = shipIds.length
      ? await shippingLineRepo
          .createQueryBuilder('ln')
          .leftJoin('ln.order', 'ord')
          .where('ord.id IN (:...ids)', { ids: shipIds })
          .getMany()
      : [];
    const quantitiesByOrder = new Map<number, { requested: number; picked: number }>();
    for (const ln of shipLines) {
      const orderId = (ln as any).order?.id || (ln as any).order_id;
      if (!orderId) continue;
      const entry = quantitiesByOrder.get(orderId) || { requested: 0, picked: 0 };
      entry.requested += parseFloat(String(ln.requested_qty || 0)) || 0;
      entry.picked += parseFloat(String(ln.picked_qty || 0)) || 0;
      quantitiesByOrder.set(orderId, entry);
    }

    const recAssigneeRows = recIds.length
      ? await this.assignRepo.find({ where: { task_type: 'RECEIVING', task_id: In(recIds) } as any })
      : [];
    const shipAssigneeRows = shipIds.length
      ? await this.assignRepo.find({ where: { task_type: 'SHIPPING', task_id: In(shipIds) } as any })
      : [];

    const recAssigneesMap = new Map<number, any[]>();
    for (const row of recAssigneeRows) {
      const list = recAssigneesMap.get(row.task_id) || [];
      list.push({
        id: row.id,
        user_id: row.user_id,
        user_name:
          (row as any).user?.full_name ||
          (row as any).user?.name ||
          (row as any).user?.username ||
          `ID ${row.user_id}`,
        status: row.status,
        started_at: row.started_at ? row.started_at.toISOString() : null,
        completed_at: row.completed_at ? row.completed_at.toISOString() : null,
      });
      recAssigneesMap.set(row.task_id, list);
    }

    const shipAssigneesMap = new Map<number, any[]>();
    for (const row of shipAssigneeRows) {
      const list = shipAssigneesMap.get(row.task_id) || [];
      list.push({
        id: row.id,
        user_id: row.user_id,
        user_name:
          (row as any).user?.full_name ||
          (row as any).user?.name ||
          (row as any).user?.username ||
          `ID ${row.user_id}`,
        status: row.status,
        started_at: row.started_at ? row.started_at.toISOString() : null,
        completed_at: row.completed_at ? row.completed_at.toISOString() : null,
      });
      shipAssigneesMap.set(row.task_id, list);
    }

    const recInfoMap = new Map<number, TaskAssignmentInfo>();
    recInfos.forEach(info => recInfoMap.set(info.task_id, info));
    const shipInfoMap = new Map<number, TaskAssignmentInfo>();
    shipInfos.forEach(info => shipInfoMap.set(info.task_id, info));

    const receivingTasks = recDocs.map(doc => {
      const info = recInfoMap.get(doc.id);
      const agg = itemsByDoc.get(doc.id) || { expected: 0, received: 0 };
      const expected = Number(agg.expected) || 0;
      const received = Number(agg.received) || 0;
      const percent = expected > 0 ? Math.min(100, Math.max(0, Math.round((received / expected) * 100))) : 0;
      const assignees = recAssigneesMap.get(doc.id) || [];
      const activeAssignees = assignees.filter(a => a.status !== 'DONE');
      const referenceTime = doc.started_at || doc.created_at;
      const ageMinutes = referenceTime ? Math.max(0, Math.floor((now - new Date(referenceTime).getTime()) / 60000)) : null;
      return {
        id: doc.id,
        task_type: 'RECEIVING',
        document_number: doc.document_number,
        supplier_name: doc.supplier?.name || null,
        status: doc.status,
        expected_qty: expected,
        received_qty: received,
        percent_complete: percent,
        policy: info?.policy || 'ANY_DONE',
        team_id: info?.team_id || teamId,
        assigned_at: info?.updated_at ? info.updated_at.toISOString() : info?.created_at ? info.created_at.toISOString() : null,
        created_at: doc.created_at ? doc.created_at.toISOString() : null,
        started_at: doc.started_at ? doc.started_at.toISOString() : null,
        completed_at: doc.completed_at ? doc.completed_at.toISOString() : null,
        age_min: ageMinutes,
        assignees,
        active_assignees_count: activeAssignees.length,
      };
    });

    const shippingTasks = shipOrders.map(order => {
      const info = shipInfoMap.get(order.id);
      const agg = quantitiesByOrder.get(order.id) || { requested: 0, picked: 0 };
      const requested = Number(agg.requested) || 0;
      const picked = Number(agg.picked) || 0;
      const percent = requested > 0 ? Math.min(100, Math.max(0, Math.round((picked / requested) * 100))) : 0;
      const assignees = shipAssigneesMap.get(order.id) || [];
      const activeAssignees = assignees.filter(a => a.status !== 'DONE');
      const referenceTime = order.started_at || order.created_at;
      const ageMinutes = referenceTime ? Math.max(0, Math.floor((now - new Date(referenceTime).getTime()) / 60000)) : null;
      return {
        id: order.id,
        task_type: 'SHIPPING',
        order_number: order.order_number,
        customer_name: order.customer_name || null,
        status: order.status,
        requested_qty: Math.round(requested * 1000) / 1000,
        picked_qty: Math.round(picked * 1000) / 1000,
        percent_complete: percent,
        policy: info?.policy || 'ANY_DONE',
        team_id: info?.team_id || teamId,
        assigned_at: info?.updated_at ? info.updated_at.toISOString() : info?.created_at ? info.created_at.toISOString() : null,
        created_at: order.created_at ? order.created_at.toISOString() : null,
        started_at: order.started_at ? order.started_at.toISOString() : null,
        staged_at: order.staged_at ? order.staged_at.toISOString() : null,
        loaded_at: order.loaded_at ? order.loaded_at.toISOString() : null,
        completed_at: order.completed_at ? order.completed_at.toISOString() : null,
        age_min: ageMinutes,
        assignees,
        active_assignees_count: activeAssignees.length,
      };
    });

    const sortTasks = (arr: any[]) =>
      arr.sort((a, b) => {
        const aAge = typeof a.age_min === 'number' ? a.age_min : Number.MAX_SAFE_INTEGER;
        const bAge = typeof b.age_min === 'number' ? b.age_min : Number.MAX_SAFE_INTEGER;
        return aAge - bAge;
      });

    sortTasks(receivingTasks);
    sortTasks(shippingTasks);

    // Map SKART documents to task format
    const skartTasks = skartDocs.map(sd => {
      const ageMinutes = Math.floor((Date.now() - new Date(sd.created_at).getTime()) / 60000);
      return {
        id: sd.id,
        task_type: 'SKART',
        uid: sd.uid,
        store_name: (sd as any).store?.name || null,
        status: sd.status,
        created_at: sd.created_at ? sd.created_at.toISOString() : null,
        age_min: ageMinutes,
        assigned_to_user_id: sd.assigned_to_user_id,
      };
    });

    // Map POVRACAJ documents to task format
    const povracajTasks = povracajDocs.map(pd => {
      const ageMinutes = Math.floor((Date.now() - new Date(pd.created_at).getTime()) / 60000);
      return {
        id: pd.id,
        task_type: 'POVRACAJ',
        uid: pd.uid,
        store_name: (pd as any).store?.name || null,
        status: pd.status,
        created_at: pd.created_at ? pd.created_at.toISOString() : null,
        age_min: ageMinutes,
        assigned_to_user_id: pd.assigned_to_user_id,
      };
    });

    // Sort SKART tasks by age
    skartTasks.sort((a, b) => {
      const aAge = typeof a.age_min === 'number' ? a.age_min : Number.MAX_SAFE_INTEGER;
      const bAge = typeof b.age_min === 'number' ? b.age_min : Number.MAX_SAFE_INTEGER;
      return aAge - bAge;
    });

    // Sort POVRACAJ tasks by age
    povracajTasks.sort((a, b) => {
      const aAge = typeof a.age_min === 'number' ? a.age_min : Number.MAX_SAFE_INTEGER;
      const bAge = typeof b.age_min === 'number' ? b.age_min : Number.MAX_SAFE_INTEGER;
      return aAge - bAge;
    });

    return {
      team: { id: teamId, name: teamName },
      members,
      summary: {
        total: receivingTasks.length + shippingTasks.length + skartTasks.length + povracajTasks.length,
        receiving: receivingTasks.length,
        shipping: shippingTasks.length,
        skart: skartTasks.length,
        povracaj: povracajTasks.length,
      },
      receiving: receivingTasks,
      shipping: shippingTasks,
      skart: skartTasks,
      povracaj: povracajTasks,
    };
  }

  shiftTypes() {
    return [
      { value: 'PRVA', label: 'Prva smena (08-15)' },
      { value: 'DRUGA', label: 'Druga smena (12-19)' },
      { value: 'OFF', label: 'Nije u smeni' },
    ];
  }

  async assignShift(actor: { id: number; role: string }, body: { user_id: number; shift_type: string }) {
    if (!['admin', 'sef_magacina'].includes(actor.role)) {
      throw new ForbiddenException('Samo admin/šef magacina može menjati smene.');
    }
    if (!body || !body.user_id || !['PRVA','DRUGA','OFF'].includes(body.shift_type)) {
      throw new BadRequestException('Neispravan zahtev');
    }
    const today = todayDateString();
    let row = await this.shiftRepo.findOne({ where: { user_id: body.user_id, shift_date: today } as any });
    if (!row) {
      row = this.shiftRepo.create({ user_id: body.user_id, shift_type: body.shift_type, shift_date: today, assigned_by_user_id: actor.id });
    } else {
      row.shift_type = body.shift_type;
      row.assigned_by_user_id = actor.id;
    }
    await this.shiftRepo.save(row);
    return { ok: true };
  }

  // Teams ranking for admin Analytics UI
  async analyticsTeams(fromStr?: string, toStr?: string) {
    let from: number | undefined;
    let to: number | undefined;
    try { if (fromStr) from = new Date(fromStr).getTime(); } catch {}
    try { if (toStr) to = new Date(toStr).getTime(); } catch {}
    // Based on TaskAssignmentInfo.team_id aggregation (RECEIVING + SHIPPING)
    const infos = await this.assignInfoRepo.createQueryBuilder('i')
      .where('i.team_id IS NOT NULL')
      .andWhere("i.task_type IN ('RECEIVING','SHIPPING')")
      .getMany();
    if (!infos.length) return [];

    const teamIds = Array.from(new Set(infos.map((i:any)=> i.team_id).filter(Boolean)));
    const teams = await this.teamRepo.findByIds(teamIds as number[]);
    const teamName = new Map<number,string>();
    teams.forEach(t => teamName.set(t.id, (t as any).name || `Tim ${t.id}`));

    const membersRows = await this.memberRepo.createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'u')
      .where('m.team_id IN (:...ids)', { ids: teamIds })
      .getMany();
    const membersByTeam = new Map<number, { ids:number[]; names:string[] }>();
    for (const m of membersRows) {
      const rec = membersByTeam.get(m.team_id) || { ids:[], names:[] };
      rec.ids.push(m.user_id);
      const uname = ((m as any).user?.full_name || (m as any).user?.name || (m as any).user?.username || `#${m.user_id}`);
      rec.names.push(uname);
      membersByTeam.set(m.team_id, rec);
    }

    // Item aggregations
    const recItems = await this.itemRepo.find();
    const itemsByDoc = new Map<number, { expected:number; received:number }>();
    for (const it of recItems) {
      const docId = (it as any).receiving_document_id || (it as any).document_id || (it as any).receivingDocument?.id;
      const exp = parseFloat(String((it as any).expected_quantity || 0));
      const rec = parseFloat(String((it as any).received_quantity || 0));
      const cur = itemsByDoc.get(docId) || { expected:0, received:0 };
      cur.expected += exp; cur.received += rec; itemsByDoc.set(docId, cur);
    }
    const shipLines = await this.shippingRepo.manager.getRepository(require('../entities/shipping-order-line.entity').ShippingOrderLine).find();
    const itemsByOrder = new Map<number, { requested:number; picked:number }>();
    for (const ln of shipLines) {
      const orderId = (ln as any).order?.id || (ln as any).shipping_order_id || (ln as any).order_id;
      const req = parseFloat(String((ln as any).requested_qty || (ln as any).requested || 0));
      const pic = parseFloat(String((ln as any).picked_qty || (ln as any).picked || 0));
      const cur = itemsByOrder.get(orderId) || { requested:0, picked:0 };
      cur.requested += req; cur.picked += pic; itemsByOrder.set(orderId, cur);
    }
    const recDocs = await this.docRepo.find();
    const recStatus = new Map<number,string>();
    const recTime = new Map<number, number>();
    recDocs.forEach(d => {
      recStatus.set(d.id, (d as any).status);
      const ts = (d as any).completed_at || (d as any).started_at || (d as any).created_at;
      if (ts) recTime.set(d.id, new Date(ts).getTime());
    });
    const shipOrders = await this.shippingRepo.find();
    const shipStatus = new Map<number,string>();
    const shipTime = new Map<number, number>();
    shipOrders.forEach(o => {
      shipStatus.set(o.id, (o as any).status);
      const ts = (o as any).closed_at || (o as any).loaded_at || (o as any).started_at || (o as any).created_at;
      if (ts) shipTime.set(o.id, new Date(ts).getTime());
    });

    const agg = new Map<number, { rec:{box:number;done:number;items:number;itemsDone:number}; ship:{box:number;done:number;items:number;itemsDone:number} }>();
    for (const i of infos) {
      const tid = (i as any).team_id as number;
      if (!tid) continue;
      const a = agg.get(tid) || { rec:{box:0,done:0,items:0,itemsDone:0}, ship:{box:0,done:0,items:0,itemsDone:0} };
      if (i.task_type === 'RECEIVING') {
        // Period filter
        if (from || to) {
          const t = recTime.get(i.task_id);
          if (t && ((from && t < from) || (to && t > to))) continue;
        }
        a.rec.box += 1;
        const st = recStatus.get(i.task_id) || '';
        if (st === 'completed') a.rec.done += 1;
        const it = itemsByDoc.get(i.task_id);
        if (it) { a.rec.items += it.expected; a.rec.itemsDone += it.received; }
      } else if (i.task_type === 'SHIPPING') {
        if (from || to) {
          const t = shipTime.get(i.task_id);
          if (t && ((from && t < from) || (to && t > to))) continue;
        }
        a.ship.box += 1;
        const st = shipStatus.get(i.task_id) || '';
        if (st === 'CLOSED' || st === 'LOADED') a.ship.done += 1;
        const it = itemsByOrder.get(i.task_id);
        if (it) { a.ship.items += it.requested; a.ship.itemsDone += it.picked; }
      }
      agg.set(tid, a);
    }

    const out = Array.from(agg.entries()).map(([tid, v]) => {
      const tname = teamName.get(tid) || `Tim ${tid}`;
      const mem = membersByTeam.get(tid) || { ids:[], names:[] };
      const assigned = v.rec.box + v.ship.box;
      const completed = v.rec.done + v.ship.done;
      const itemsTotal = v.rec.items + v.ship.items;
      const itemsDone = v.rec.itemsDone + v.ship.itemsDone;
      const pct = assigned ? Math.round((completed/assigned)*100) : 0;
      const ipct = itemsTotal ? Math.round((itemsDone/itemsTotal)*100) : 0;
      return {
        team_id: tid,
        team_name: tname,
        members: mem.names,
        // split counts for UI that needs active per type
        rec_assigned: v.rec.box,
        rec_completed: v.rec.done,
        ship_assigned: v.ship.box,
        ship_completed: v.ship.done,
        assigned,
        completed,
        items_total: Math.round(itemsTotal),
        items_completed: Math.round(itemsDone),
        percent: pct,
        items_percent: ipct,
      };
    }).sort((a,b)=> b.percent - a.percent || b.items_percent - a.items_percent);

    return out;
  }
}
