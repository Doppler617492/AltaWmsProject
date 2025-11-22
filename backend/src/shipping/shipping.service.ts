import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { ShippingLoadPhoto } from '../entities/shipping-load-photo.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { User } from '../entities/user.entity';
import { Item } from '../entities/item.entity';
import { Location } from '../entities/location.entity';
import { Supplier } from '../entities/supplier.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { PerformanceService } from '../performance/performance.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AssignmentsGateway } from '../workforce/assignments.gateway';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingOrder) private orders: Repository<ShippingOrder>,
    @InjectRepository(ShippingOrderLine) private lines: Repository<ShippingOrderLine>,
    @InjectRepository(ShippingLoadPhoto) private photos: Repository<ShippingLoadPhoto>,
    @InjectRepository(Inventory) private inv: Repository<Inventory>,
    @InjectRepository(InventoryMovement) private moves: Repository<InventoryMovement>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Item) private items: Repository<Item>,
    @InjectRepository(Location) private locations: Repository<Location>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(TaskAssignee) private taskAssignees: Repository<TaskAssignee>,
    @InjectRepository(TaskAssignmentInfo) private taskAssignmentInfo: Repository<TaskAssignmentInfo>,
    @InjectRepository(Team) private teams: Repository<Team>,
    @InjectRepository(TeamMember) private teamMembers: Repository<TeamMember>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @Optional() private readonly performanceService?: PerformanceService,
    @Optional() @Inject(forwardRef(() => AssignmentsGateway))
    private readonly assignmentsWs?: AssignmentsGateway,
  ) {}

  private async getDefaultSupplierId(): Promise<number> {
    // Try to find any supplier to satisfy FK; prefer a generic one
    let s = await this.suppliers.findOne({ where: { name: 'Pantheon' } });
    if (!s) s = await this.suppliers.findOne({ where: { name: 'Unknown' } });
    if (!s) s = await this.suppliers.findOne({ where: {} });
    if (!s) {
      s = this.suppliers.create({ name: 'Unknown', country: '-', address: 'Auto-created' });
      s = await this.suppliers.save(s);
    }
    return s.id;
  }

  private decodeCellValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return value.toString().trim();
    if (typeof value === 'string') return value.trim();
    return '';
  }

  private parseDocumentDate(value?: string | Date | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const raw = String(value).trim();
    if (!raw) return null;
    const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
    const parts = normalized.split('-').map(part => part.trim());
    let isoCandidate = normalized;
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        isoCandidate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        isoCandidate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    const parsed = new Date(isoCandidate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private mapOrderStatusToAssigneeStatus(status: ShippingOrder['status']): 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' {
    if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(status)) {
      return 'DONE';
    }
    if (['PICKING', 'STAGED', 'LOADED'].includes(status)) {
      return 'IN_PROGRESS';
    }
    return 'ASSIGNED';
  }

  private async syncAssignees(orderId: number, userIds: number[], teamId: number | null, actorUserId?: number | null) {
    let resolvedUserIds = [...new Set(userIds.filter(id => Number.isFinite(id) && id > 0))];
    if (teamId) {
      const members = await this.teamMembers.find({ where: { team_id: teamId, is_active: true } });
      const memberIds = members.map(m => m.user_id).filter(id => Number.isFinite(id) && id > 0);
      resolvedUserIds = [...new Set([...resolvedUserIds, ...memberIds])];
    }

    const existingInfo = await this.taskAssignmentInfo.findOne({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    if (!existingInfo) {
      const info = this.taskAssignmentInfo.create({
        task_type: 'SHIPPING',
        task_id: orderId,
        policy: 'ANY_DONE',
        team_id: teamId ?? null,
        created_by_user_id: actorUserId ?? null,
      });
      await this.taskAssignmentInfo.save(info);
    } else {
      const changed = (existingInfo.team_id || null) !== (teamId ?? null);
      if (changed || (actorUserId && !existingInfo.created_by_user_id)) {
        existingInfo.team_id = teamId ?? null;
        if (actorUserId && !existingInfo.created_by_user_id) {
          existingInfo.created_by_user_id = actorUserId;
        }
        if (!resolvedUserIds.length && existingInfo.team_id) {
          const members = await this.teamMembers.find({ where: { team_id: existingInfo.team_id, is_active: true } });
          const memberIds = members.map(m => m.user_id).filter(id => Number.isFinite(id) && id > 0);
          resolvedUserIds = [...new Set([...resolvedUserIds, ...memberIds])];
        }
        await this.taskAssignmentInfo.save(existingInfo);
      }
    }

    const existingAssignees = await this.taskAssignees.find({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    const keepIds = new Set(resolvedUserIds);
    const toDelete = existingAssignees.filter(a => !keepIds.has(a.user_id));
    if (toDelete.length) {
      await this.taskAssignees.remove(toDelete);
    }
    const existingMap = new Map(existingAssignees.map(a => [a.user_id, a] as [number, TaskAssignee]));
    for (const userId of resolvedUserIds) {
      if (existingMap.has(userId)) continue;
      const assignee = this.taskAssignees.create({
        task_type: 'SHIPPING',
        task_id: orderId,
        user_id: userId,
        status: 'ASSIGNED',
      });
      await this.taskAssignees.save(assignee);
    }
  }

  private async updateAssigneeStatuses(orderId: number, status: ShippingOrder['status']) {
    const assignees = await this.taskAssignees.find({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    if (!assignees.length) return;
    const targetStatus = this.mapOrderStatusToAssigneeStatus(status);
    const now = new Date();
    for (const assignee of assignees) {
      if (assignee.status === targetStatus) continue;
      assignee.status = targetStatus;
      if (targetStatus === 'IN_PROGRESS' && !assignee.started_at) {
        assignee.started_at = now;
      }
      if (targetStatus === 'DONE') {
        assignee.completed_at = now;
      }
    }
    await this.taskAssignees.save(assignees);
    if (targetStatus === 'DONE') {
      const info = await this.taskAssignmentInfo.findOne({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
      if (info && !info.all_done_at) {
        info.all_done_at = now;
        await this.taskAssignmentInfo.save(info);
      }
    }
  }

  private computeOrderMetrics(order: ShippingOrder, lines?: ShippingOrderLine[]) {
    const rows = lines || order.lines || [];
    let requestedTotal = 0;
    let pickedTotal = 0;
    let hasDiscrepancy = false;
    for (const line of rows) {
      const req = Number(line.requested_qty || 0);
      const pic = Number(line.picked_qty || 0);
      requestedTotal += req;
      pickedTotal += pic;
      if (line.has_discrepancy || req !== pic) {
        hasDiscrepancy = true;
      }
    }
    const progressPct = requestedTotal > 0 ? Math.round((pickedTotal / requestedTotal) * 100) : 0;
    return { requestedTotal, pickedTotal, progressPct, hasDiscrepancy };
  }

  async createOrder(body: any, requester: any) {
    if (!body?.order_number || !String(body.order_number).trim()) {
      throw new BadRequestException('Broj dokumenta je obavezan');
    }
    if (!body?.customer_name || !String(body.customer_name).trim()) {
      throw new BadRequestException('Naziv kupca / primalac je obavezan');
    }
    const creator = await this.users.findOne({ where: { id: requester.id } });
    if (!creator) throw new ForbiddenException('Invalid user');

    let assignedTeam: Team | null = null;
    if (body.assigned_team_id) {
      assignedTeam = await this.teams.findOne({ where: { id: Number(body.assigned_team_id) } });
      if (!assignedTeam) {
        throw new NotFoundException('Tim nije pronađen');
      }
    }

    const order = this.orders.create({
      order_number: String(body.order_number).trim(),
      customer_name: String(body.customer_name).trim(),
      status: 'DRAFT',
      created_by: creator,
      notes: body.notes?.toString?.().trim() || null,
      document_date: this.parseDocumentDate(body.document_date),
      store_name: body.store_name?.toString?.().trim() || null,
      responsible_person: body.responsible_person?.toString?.().trim() || null,
      invoice_number: body.invoice_number?.toString?.().trim() || null,
      assigned_team: assignedTeam || null,
      assigned_team_id: assignedTeam ? assignedTeam.id : null,
    });
    const assignedUserIds: number[] = [];
    if (body.assigned_user_id) {
      const assigned = await this.users.findOne({ where: { id: Number(body.assigned_user_id) } });
      if (assigned) {
        order.assigned_user = assigned;
        assignedUserIds.push(assigned.id);
      }
    }
    if (Array.isArray(body.assigned_user_ids)) {
      for (const value of body.assigned_user_ids) {
        const id = Number(value);
        if (Number.isFinite(id) && id > 0 && !assignedUserIds.includes(id)) {
          assignedUserIds.push(id);
        }
      }
      if (!order.assigned_user && assignedUserIds.length) {
        const first = await this.users.findOne({ where: { id: assignedUserIds[0] } });
        if (first) {
          order.assigned_user = first;
        }
      }
    }
    order.lines = [];
    for (const ln of body.lines || []) {
      const itemId = ln.item_id;
      if (!itemId) continue;
      const item = await this.items.findOne({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Item not found');
      const requestedQty = Number(ln.requested_qty);
      if (Number.isNaN(requestedQty) || requestedQty <= 0) {
        throw new BadRequestException('Nevažeća količina');
      }
      const line = this.lines.create({
        item,
        requested_qty: String(requestedQty),
        picked_qty: String(ln.picked_qty ? Number(ln.picked_qty) : 0),
        uom: ln.uom || 'KOM',
        pick_from_location_code: ln.pick_from_location_code || '',
        status_per_line: (ln.status_per_line) || 'PENDING',
        condition_notes: ln.condition_notes?.toString?.().trim() || null,
        has_discrepancy: Boolean(ln.has_discrepancy),
        discrepancy_type: ln.discrepancy_type?.toString?.().trim() || null,
      });
      order.lines.push(line);
    }
    const saved = await this.orders.save(order);

    await this.syncAssignees(saved.id, assignedUserIds, assignedTeam?.id ?? null, creator.id);
    await this.updateAssigneeStatuses(saved.id, saved.status);

    if (this.assignmentsWs) {
      const creatorName = (creator as any)?.full_name || creator.name || creator.username;
      this.assignmentsWs.broadcastTaskCreated({
        type: 'SHIPPING',
        task_id: saved.id,
        order_number: saved.order_number,
        customer_name: saved.customer_name || undefined,
        created_by_id: creator.id,
        created_by_name: creatorName,
        created_at: saved.created_at || new Date(),
      });
    }

    // Log CREATE action
    await this.logAudit(saved.id, 'CREATE', {
      actor: { id: creator.id, role: creator.role },
      order_number: saved.order_number,
      customer_name: saved.customer_name,
      assigned_user_id: saved.assigned_user_id,
      assigned_team_id: saved.assigned_team_id,
    });

    return saved;
  }

  async startOrder(orderId: number, assigned_user_id: number) {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['lines', 'assigned_team'] });
    if (!order) throw new NotFoundException('Order not found');
    const user = await this.users.findOne({ where: { id: assigned_user_id } });
    if (!user) throw new NotFoundException('User not found');
    order.status = 'PICKING';
    order.assigned_user = user;
    order.started_at = order.started_at || new Date();
    for (const l of order.lines ?? []) {
      if (l.status_per_line === 'PENDING') {
        l.status_per_line = 'PICKING';
      }
    }
    await this.orders.save(order);
    if (order.lines?.length) {
      await this.lines.save(order.lines);
    }
    await this.syncAssignees(order.id, [user.id], order.assigned_team?.id ?? null, user.id);
    await this.updateAssigneeStatuses(order.id, order.status);
    // Log START action
    await this.logAudit(order.id, 'START', {
      actor: { id: user.id, role: user.role },
      order_number: order.order_number,
      assigned_user_id: user.id,
    });
    return { ok: true };
  }

  async listActive() {
    const list = await this.orders.find({ where: [{ status: 'PICKING' }, { status: 'STAGED' }, { status: 'LOADED' }, { status: 'CLOSED' }] as any, relations: ['lines', 'assigned_user', 'created_by', 'assigned_team'] });
    const ids = list.map(o => o.id);
    const assignmentMaps = await this.fetchAssignmentMaps(ids);
    return list.map(o => {
      const metrics = this.computeOrderMetrics(o);
      const { summary, teamName } = this.formatAssignmentSummary(o.id, assignmentMaps);
      const requestedTotal = metrics.requestedTotal;
      const pickedTotal = metrics.pickedTotal;
      const lines_total = o.lines?.length || 0;
      const lines_picked = o.lines?.filter(l => ['PICKED', 'STAGED', 'LOADED'].includes(l.status_per_line)).length || 0;
      return {
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        assigned_user_name: o.assigned_user ? ((o.assigned_user as any).full_name || o.assigned_user.username) : null,
        created_by_name: o.created_by ? ((o.created_by as any).full_name || o.created_by.username) : null,
        started_at: o.started_at,
        progress_pct: metrics.progressPct,
        lines_total,
        lines_picked,
        qty_requested_total: requestedTotal,
        qty_picked_total: pickedTotal,
        age_minutes: o.started_at ? Math.floor((Date.now() - new Date(o.started_at).getTime()) / 60000) : 0,
        document_date: o.document_date || null,
        store_name: o.store_name || null,
        responsible_person: o.responsible_person || null,
        invoice_number: o.invoice_number || null,
        has_discrepancy: metrics.hasDiscrepancy,
        assigned_summary: summary,
        assigned_team_name: o.assigned_team?.name || teamName,
      };
    });
  }

  async getOrderDetail(orderId: number) {
    const o = await this.orders.findOne({ where: { id: orderId }, relations: ['lines', 'assigned_user', 'created_by', 'assigned_team'] });
    if (!o) throw new NotFoundException('Order not found');
    const metrics = this.computeOrderMetrics(o);
    const { summary, teamName } = this.formatAssignmentSummary(orderId, await this.fetchAssignmentMaps([orderId]));
    const lines_total = o.lines.length;
    const lines_picked = o.lines.filter(l => ['PICKED', 'STAGED', 'LOADED'].includes(l.status_per_line)).length;
    return {
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      status: o.status,
      assigned_user_name: o.assigned_user ? ((o.assigned_user as any).full_name || o.assigned_user.username) : null,
      created_by_name: o.created_by ? ((o.created_by as any).full_name || o.created_by.username) : null,
      started_at: o.started_at,
      staged_at: o.staged_at,
      loaded_at: o.loaded_at,
      closed_at: o.closed_at,
      completed_at: o.completed_at || null,
      progress_pct: metrics.progressPct,
      lines_total,
      lines_picked,
      qty_requested_total: metrics.requestedTotal,
      qty_picked_total: metrics.pickedTotal,
      has_discrepancy: metrics.hasDiscrepancy,
      document_date: o.document_date || null,
      store_name: o.store_name || null,
      responsible_person: o.responsible_person || null,
      invoice_number: o.invoice_number || null,
      assigned_summary: summary,
      assigned_team_name: teamName,
      lines: o.lines.map(l => ({
        line_id: l.id,
        item_sku: l.item.sku,
        item_name: l.item.name,
        requested_qty: Number(l.requested_qty),
        picked_qty: Number(l.picked_qty),
        uom: l.uom,
        status_per_line: l.status_per_line,
        pick_from_location_code: l.pick_from_location_code,
        staged_location_code: l.staged_location_code || null,
        has_discrepancy: l.has_discrepancy,
        discrepancy_type: l.discrepancy_type,
        condition_notes: l.condition_notes || null,
      })),
    };
  }

  async myOrders(userId: number) {
    const assignments = await this.taskAssignees.find({ where: { task_type: 'SHIPPING', user_id: userId, status: Not('DONE') } as any });
    const orderIds = Array.from(new Set(assignments.map(a => a.task_id))).filter(id => Number.isFinite(id));
    if (!orderIds.length) {
      return [];
    }
    const statuses = ['PICKING', 'STAGED', 'LOADED', 'CLOSED'];
    const list = await this.orders.createQueryBuilder('order')
      .leftJoinAndSelect('order.lines', 'lines')
      .leftJoinAndSelect('lines.item', 'lineItem')
      .leftJoinAndSelect('order.assigned_user', 'assigned_user')
      .leftJoinAndSelect('order.created_by', 'created_by')
      .leftJoinAndSelect('order.assigned_team', 'assigned_team')
      .where('order.id IN (:...ids)', { ids: orderIds })
      .andWhere('order.status IN (:...statuses)', { statuses })
      .orderBy('COALESCE(order.completed_at, order.loaded_at, order.started_at, order.created_at)', 'DESC')
      .getMany();
    if (!list.length) {
      return [];
    }

    const toStart: ShippingOrder[] = [];
    for (const order of list) {
      if (order.status === 'DRAFT') {
        order.status = 'PICKING';
        if (!order.started_at) {
          order.started_at = new Date();
        }
        toStart.push(order);
      }
    }
    if (toStart.length) {
      await this.orders.save(toStart);
      await Promise.all(toStart.map(o => this.updateAssigneeStatuses(o.id, o.status)));
    }

    const maps = await this.fetchAssignmentMaps(list.map(o => o.id));
    return list.map(o => {
      const metrics = this.computeOrderMetrics(o);
      const { summary, teamName } = this.formatAssignmentSummary(o.id, maps);
      return {
        order_id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        document_date: o.document_date || null,
        store_name: o.store_name || null,
        responsible_person: o.responsible_person || null,
        invoice_number: o.invoice_number || null,
        assigned_summary: summary,
        assigned_team_name: teamName,
        lines: o.lines.map(l => ({
          line_id: l.id,
          item_sku: l.item.sku,
          item_name: l.item.name,
          requested_qty: Number(l.requested_qty),
          picked_qty: Number(l.picked_qty),
          uom: l.uom,
          pick_from_location_code: l.pick_from_location_code,
          status_per_line: l.status_per_line,
          has_discrepancy: l.has_discrepancy,
          discrepancy_type: l.discrepancy_type,
          condition_notes: l.condition_notes || null,
        })),
        has_discrepancy: metrics.hasDiscrepancy,
        progress_pct: metrics.progressPct,
      };
    });
  }

  async deleteOrder(actor: { id?: number; role?: string }, orderId: number) {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['lines'] });
    if (!order) throw new NotFoundException('Order not found');
    const actorRole = (actor?.role || '').toLowerCase();
    if (order.status !== 'DRAFT' && actorRole !== 'admin') {
      throw new ForbiddenException('Brisanje je dozvoljeno samo za DRAFT naloge');
    }
    if (order.lines && order.lines.length) {
      await this.lines.remove(order.lines);
    }
    await this.taskAssignees.delete({ task_type: 'SHIPPING', task_id: orderId } as any);
    await this.taskAssignmentInfo.delete({ task_type: 'SHIPPING', task_id: orderId } as any);
    await this.orders.delete(orderId);
    return { ok: true };
  }

  async deleteOrdersBulk(actor: { id?: number; role?: string }, orderIds: number[]) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('Nema naloga za brisanje');
    }
    const actorRole = (actor?.role || '').toLowerCase();
    const isAdmin = actorRole === 'admin';
    
    const orders = await this.orders.find({ 
      where: orderIds.map(id => ({ id })) as any,
      relations: ['lines']
    });

    const results = {
      deleted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const order of orders) {
      try {
        // Only allow deletion of DRAFT orders unless admin
        if (order.status !== 'DRAFT' && !isAdmin) {
          results.skipped++;
          results.errors.push(`Nalog ${order.order_number} nije DRAFT status`);
          continue;
        }

        if (order.lines && order.lines.length) {
          await this.lines.remove(order.lines);
        }
        await this.taskAssignees.delete({ task_type: 'SHIPPING', task_id: order.id } as any);
        await this.taskAssignmentInfo.delete({ task_type: 'SHIPPING', task_id: order.id } as any);
        await this.orders.delete(order.id);
        results.deleted++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(`Greška pri brisanju naloga ${order.order_number}: ${e?.message || String(e)}`);
      }
    }

    return results;
  }

  async deleteLine(actor: { id?: number; role?: string }, lineId: number) {
    const line = await this.lines.findOne({ where: { id: lineId }, relations: ['order'] as any });
    if (!line) throw new NotFoundException('Linija nije pronađena');
    // Using query to fetch order since relation alias might differ
    const order = await this.orders.createQueryBuilder('o')
      .leftJoin('o.lines', 'l')
      .where('l.id = :lid', { lid: lineId })
      .getOne();
    const picked = Number(line.picked_qty || 0);
    if (!order) throw new NotFoundException('Order nije pronađen');
    const actorRole = (actor?.role || '').toLowerCase();
    if ((order.status !== 'DRAFT' || picked > 0) && actorRole !== 'admin') {
      throw new ForbiddenException('Liniju je moguće obrisati samo u DRAFT nalogu i ako nije odabrana');
    }
    await this.lines.delete(lineId);
    return { ok: true };
  }

  async pickLine(lineId: number, userId: number, picked_qty: number, from_location_code: string, reason: string | null = null) {
    const line = await this.lines.findOne({ where: { id: lineId }, relations: ['order', 'item', 'order.assigned_user'] });
    if (!line) throw new NotFoundException('Line not found');
    if (!line.order || !line.order.assigned_user || line.order.assigned_user.id !== userId) throw new ForbiddenException('Not your order');

    const requestedQty = Number(line.requested_qty || 0);
    const currentPicked = Number(line.picked_qty || 0);
    const targetPicked = Number(picked_qty);
    if (Number.isNaN(targetPicked) || targetPicked < 0) {
      throw new BadRequestException('Nevažeća količina');
    }
    const delta = targetPicked - currentPicked;
    const requiresReason = targetPicked !== requestedQty;
    const trimmedReason = reason?.toString?.().trim() || '';
    if (requiresReason && !trimmedReason) {
      throw new BadRequestException('Napomena je obavezna kada količina ne odgovara traženoj');
    }

    const fallbackLocation = (from_location_code ?? line.pick_from_location_code ?? '').toString().trim();
    let fromLoc: Location | null = null;
    if (fallbackLocation) {
      fromLoc = await this.locations.findOne({ where: { code: fallbackLocation } });
      if (!fromLoc) {
        throw new NotFoundException('Lokacija nije pronađena');
      }
    }

    if (delta !== 0 && fromLoc) {
      let invRow = await this.inv.findOne({ where: { item_id: line.item.id, location_id: fromLoc.id } });
      if (!invRow) {
        if (delta > 0) {
          throw new ForbiddenException('Nema zalihe na lokaciji');
        }
        const created = this.inv.create({ item_id: line.item.id, location_id: fromLoc.id, quantity: '0' } as any);
        invRow = Array.isArray(created) ? created[0] : created;
      }
      const have = Number(invRow.quantity || 0);
      if (delta > 0 && have < delta) {
        throw new ForbiddenException('Nema dovoljno zalihe na lokaciji');
      }

      invRow.quantity = String(have - delta);
      await this.inv.save(invRow);

      const stagingCode = line.staged_location_code || 'STAGING-DOCK-01';
      const stagingLoc = await this.locations.findOne({ where: { code: stagingCode } }).catch(() => null);
      const movementReason = (() => {
        if (targetPicked > requestedQty) return trimmedReason ? `PICK-OVER:${trimmedReason}` : 'PICK-OVER';
        if (targetPicked < requestedQty) return trimmedReason ? `PICK-UNDER:${trimmedReason}` : 'PICK-UNDER';
        return trimmedReason ? `PICK:${trimmedReason}` : 'PICK';
      })();
      const quantityChange = delta > 0 ? -delta : Math.abs(delta);
      const toLocationId = delta > 0 ? (stagingLoc?.id || null) : fromLoc.id;
      const fromLocationId = delta > 0 ? fromLoc.id : (stagingLoc?.id || null);
      await this.moves.manager.query(
        `INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          line.item.id,
          fromLocationId,
          toLocationId,
          quantityChange,
          delta > 0 ? movementReason : `PICK-ADJUST:${movementReason}`,
          line.order.id,
          userId,
        ]
      );
      if (delta > 0) {
        line.staged_location_code = stagingCode;
      }
    }

    line.picked_qty = String(targetPicked);
    line.status_per_line = targetPicked >= requestedQty ? 'PICKED' : 'PICKING';
    line.has_discrepancy = targetPicked !== requestedQty;
    line.discrepancy_type = targetPicked > requestedQty ? 'OVER' : (targetPicked < requestedQty ? 'UNDER' : null);
    if (trimmedReason) {
      line.condition_notes = trimmedReason;
    } else if (!line.has_discrepancy) {
      line.condition_notes = null;
    }
    await this.lines.save(line);

    const order = await this.orders.findOne({ where: { id: line.order.id }, relations: ['lines'] });
    if (order) {
      const metrics = this.computeOrderMetrics(order);
      order.has_discrepancy = metrics.hasDiscrepancy;
      await this.orders.save(order);
      await this.updateAssigneeStatuses(order.id, order.status);
    }
    if (this.performanceService) {
      this.performanceService.triggerRefresh('shipping-pick').catch(() => undefined);
    }
    return { ok: true };
  }

  async stageOrder(orderId: number, actorId: number) {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['lines', 'assigned_user'] });
    if (!order) throw new NotFoundException('Order not found');
    if (order.assigned_user && order.assigned_user.id !== actorId) {
      // allow also sef_magacina via controller RBAC, here minimal check
    }
    order.status = 'STAGED';
    order.staged_at = new Date();
    for (const l of order.lines) {
      if (l.status_per_line === 'PICKED') l.status_per_line = 'STAGED';
    }
    await this.orders.save(order);
    await this.updateAssigneeStatuses(order.id, order.status);
    return { ok: true };
  }

  async finishOrderFromPwa(orderId: number, actorId: number) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['lines', 'lines.item', 'assigned_user', 'assigned_team'],
    });
    if (!order) throw new NotFoundException('Order not found');

    let primaryAssigneeId = order.assigned_user?.id ?? null;
    if (!primaryAssigneeId && actorId) {
      const actorUser = await this.users.findOne({ where: { id: actorId } });
      if (actorUser) {
        order.assigned_user = actorUser;
        order.assigned_user_id = actorUser.id;
        primaryAssigneeId = actorUser.id;
      }
    }

    const now = new Date();
    if (order.status !== 'STAGED') {
      order.status = 'STAGED';
      order.staged_at = now;
      for (const l of order.lines) {
        if (l.status_per_line === 'PICKED') l.status_per_line = 'STAGED';
      }
    } else if (!order.staged_at) {
      order.staged_at = now;
    }
    order.completed_at = now;
    await this.orders.save(order);

    if (primaryAssigneeId) {
      await this.syncAssignees(order.id, [primaryAssigneeId], order.assigned_team?.id ?? null, actorId ?? primaryAssigneeId);
    }

    const finishAssignees = await this.taskAssignees.find({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    if (finishAssignees.length) {
      for (const a of finishAssignees) {
        a.status = 'DONE';
        if (!a.started_at) {
          a.started_at = now;
        }
        a.completed_at = now;
      }
      await this.taskAssignees.save(finishAssignees);
    }

    const info = await this.taskAssignmentInfo.findOne({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    if (info) {
      info.all_done_at = now;
      await this.taskAssignmentInfo.save(info);
    }

    const movementUserId = primaryAssigneeId ?? finishAssignees[0]?.user_id ?? actorId ?? 1;
    const existingPickMovements = await this.moves.count({ where: { reason: 'PICK', reference_document_id: orderId } as any });
    if (existingPickMovements === 0) {
      const locationCache = new Map<string, number | null>();
      for (const line of order.lines) {
        const picked = Number(line.picked_qty || 0);
        if (!(picked > 0) || !line.item) continue;
        let fromLocationId: number | null = null;
        const code = line.pick_from_location_code?.trim();
        if (code) {
          if (locationCache.has(code)) {
            fromLocationId = locationCache.get(code)!;
          } else {
            const loc = await this.locations.findOne({ where: { code } });
            fromLocationId = loc?.id ?? null;
            locationCache.set(code, fromLocationId);
          }
        }
        const movement = this.moves.create({
          item_id: line.item.id,
          from_location_id: fromLocationId,
          to_location_id: null,
          quantity_change: -picked,
          reason: 'PICK',
          reference_document_id: orderId,
          created_by: movementUserId,
        });
        await this.moves.save(movement);
      }
    }

    // Log COMPLETE action
    const actorUser = await this.users.findOne({ where: { id: actorId } });
    await this.logAudit(order.id, 'COMPLETE', {
      actor: actorUser ? { id: actorUser.id, role: actorUser.role } : { id: actorId, role: 'magacioner' },
      order_number: order.order_number,
      lines_count: order.lines?.length || 0,
    });

    // Get assignment info to determine if it's a team or individual assignment
    const assignmentInfo = await this.taskAssignmentInfo.findOne({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    const assignees = await this.taskAssignees.find({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    
    // Get worker/team info for notification
    let workerId: number | undefined;
    let workerName: string | undefined;
    let teamId: number | undefined;
    let teamName: string | undefined;
    
    if (assignmentInfo?.team_id) {
      teamId = assignmentInfo.team_id;
      const team = await this.teams.findOne({ where: { id: teamId } });
      teamName = team?.name;
    } else if (assignees.length > 0) {
      const assignee = assignees[0];
      workerId = assignee.user_id;
      const user = await this.users.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    } else if (order.assigned_user_id) {
      workerId = order.assigned_user_id;
      const user = await this.users.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    }
    
    // Broadcast task completion notification
    if (this.assignmentsWs) {
      try {
        this.assignmentsWs.broadcastTaskCompleted({
          type: 'SHIPPING',
          task_id: order.id,
          order_number: order.order_number,
          worker_id: workerId,
          worker_name: workerName,
          team_id: teamId,
          team_name: teamName,
          completed_at: order.completed_at,
        });
      } catch (e) {
        // Ignore WebSocket errors
      }
    }

    if (this.performanceService) {
      this.performanceService.triggerRefresh('shipping-finish').catch(() => undefined);
    }

    return { ok: true, status: order.status };
  }

  async loadOrder(orderId: number) {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['lines'] });
    if (!order) throw new NotFoundException('Order not found');
    order.status = 'LOADED';
    order.loaded_at = new Date();
    for (const l of order.lines) {
      if (l.status_per_line === 'STAGED') l.status_per_line = 'LOADED';
    }
    await this.orders.save(order);
    await this.updateAssigneeStatuses(order.id, order.status);
    if (this.performanceService) {
      this.performanceService.triggerRefresh('shipping-load').catch(() => undefined);
    }
    return { ok: true };
  }

  async closeOrder(orderId: number) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    order.status = 'CLOSED';
    const now = new Date();
    order.closed_at = now;
    order.completed_at = now;
    await this.orders.save(order);
    await this.updateAssigneeStatuses(order.id, order.status);
    
    // Get assignment info to determine if it's a team or individual assignment
    const assignmentInfo = await this.taskAssignmentInfo.findOne({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    const assignees = await this.taskAssignees.find({ where: { task_type: 'SHIPPING', task_id: orderId } as any });
    
    // Get worker/team info for notification
    let workerId: number | undefined;
    let workerName: string | undefined;
    let teamId: number | undefined;
    let teamName: string | undefined;
    
    if (assignmentInfo?.team_id) {
      teamId = assignmentInfo.team_id;
      const team = await this.teams.findOne({ where: { id: teamId } });
      teamName = team?.name;
    } else if (assignees.length > 0) {
      const assignee = assignees[0];
      workerId = assignee.user_id;
      const user = await this.users.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    } else if (order.assigned_user_id) {
      workerId = order.assigned_user_id;
      const user = await this.users.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    }
    
    // Broadcast task completion notification
    if (this.assignmentsWs) {
      try {
        this.assignmentsWs.broadcastTaskCompleted({
          type: 'SHIPPING',
          task_id: order.id,
          order_number: order.order_number,
          worker_id: workerId,
          worker_name: workerName,
          team_id: teamId,
          team_name: teamName,
          completed_at: order.completed_at,
        });
      } catch (e) {
        // Ignore WebSocket errors
      }
    }
    
    if (this.performanceService) {
      this.performanceService.triggerRefresh('shipping-close').catch(() => undefined);
    }
    return { ok: true };
  }

  async getSummary() {
    const all = await this.orders.find({});
    const loadingNow = all.filter(o => ['PICKING', 'LOADED'].includes(o.status)).length;
    const stagedReady = all.filter(o => o.status === 'STAGED').length;
    return { loading_now: loadingNow, staged_ready: stagedReady };
  }

  async importFromPantheon(file: any, customerName: string, userId: number, previewOnly = false) {
    const xlsx = require('xlsx');
    const fs = require('fs');
    
    if (!file) {
      throw new Error('Excel fajl nije priložen');
    }

    console.log('File received:', { originalname: file?.originalname, mimetype: file?.mimetype, bufferLength: file?.buffer?.length, path: file?.path });

    // Parse Excel file
    let workbook;
    try {
      const buf: Buffer = file?.buffer || (file?.path ? fs.readFileSync(file.path) : null);
      if (!buf) throw new Error('Prazan fajl ili nije učitan');
      workbook = xlsx.read(buf, { type: 'buffer' });
    } catch (e: any) {
      console.error('XLSX parse error:', e.message);
      throw new Error('Greška pri čitanju Excel fajla: ' + e.message);
    }
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    // Extract document info from Excel
    // For Otprema/Prenos files:
    // Row 2 (index 2): contains document type info and Izdavalac/Primalac
    // Row 3 (index 3): contains document number (first cell) and Primalac (receiver store)
    // Row 4 (index 4): header row
    // Row 5+ (index 5+): item rows
    
    let documentNumber = '';
    let receiverStore = '';
    let issuerStore = '';
    let responsiblePerson = '';
    let documentDate: string | null = null;
    let invoiceNumber = '';
    
    // Try to detect if this is a PRENOS (shipping) file or PRIJEM (receiving) file
    let isPrenos = false;
    if (data[1] && data[1][0] && data[1][0].toString().includes('PRENOS')) {
      isPrenos = true;
    }
    
    if (isPrenos) {
      // PRENOS file structure (shipping)
      // Row 3 (index 3): Document number in first cell, Primalac in column 9
      if (data[3]) {
        documentNumber = data[3][0]?.toString().trim() || '';
        receiverStore = data[3][9]?.toString().trim() || '';
      }
      
      // If receiver store not found, use the provided customer name
      if (!receiverStore) {
        receiverStore = customerName;
      }
    } else {
      // PRIJEM file structure (receiving) - existing logic
      if (data[4]) {
        const row4 = data[4];
        documentNumber = row4[12]?.toString().trim() || '';
      }
      receiverStore = customerName;
    }

    // Try to find a document number anywhere in first 10 rows if still empty
    if (!documentNumber) {
      for (let r = 0; r < Math.min(10, data.length); r++) {
        for (let c = 0; c < (data[r]?.length || 0); c++) {
          const v = data[r][c];
          if (!v) continue;
          const s = v.toString();
          if (/\d{2}-\d{2}[A-Z]{2}-\d{6}/.test(s) || /\d{2}-\d{2}[A-Za-z]{2}-\d{6}/.test(s)) {
            documentNumber = s.trim();
            break;
          }
        }
        if (documentNumber) break;
      }
    }
    // Extract Izdavalac/Primalac/Datum/Odgovorna osoba by scanning top region
    const findRightNeighbor = (label: string) => {
      const needle = label.toLowerCase();
      for (let r = 0; r < Math.min(30, data.length); r++) {
        const row = data[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          const s = (cell ?? '').toString().trim().toLowerCase();
          if (!s) continue;
          if (s === needle || s.includes(needle)) {
            for (let k = c + 1; k <= Math.min(c + 6, row.length - 1); k++) {
              const vv = row[k];
              if (vv && vv.toString().trim()) return vv.toString().trim();
            }
          }
        }
      }
      return '';
    };
    issuerStore = findRightNeighbor('izdavalac') || issuerStore;
    receiverStore = receiverStore || findRightNeighbor('primalac') || customerName;
    const foundDt = findRightNeighbor('datum');
    if (foundDt) documentDate = foundDt;
    responsiblePerson = findRightNeighbor('odgovorna osoba') || responsiblePerson;
    const foundInvoice = findRightNeighbor('račun') || findRightNeighbor('racun') || findRightNeighbor('raèun') || '';
    if (foundInvoice) invoiceNumber = foundInvoice;
    if (!documentNumber) {
      // fallback to filename before extension
      documentNumber = (file.originalname || '').replace(/\.[^.]+$/, '') || 'PANTHEON-DOC';
    }

    // Create order with customer name (store name for komercialista)
    const creator = await this.users.findOne({ where: { id: userId } });
    if (!creator) throw new ForbiddenException('Invalid user');

    const order = this.orders.create({
      order_number: documentNumber,
      customer_name: receiverStore || customerName,
      status: 'DRAFT',
      created_by: creator,
      notes: `Importovano iz Pantheon: ${file.originalname}` +
        (issuerStore ? ` | Izdavalac: ${issuerStore}` : '') +
        (receiverStore ? ` | Primalac: ${receiverStore}` : '') +
        (documentDate ? ` | Datum: ${documentDate}` : '') +
        (responsiblePerson ? ` | Odgovorna: ${responsiblePerson}` : '') +
        (invoiceNumber ? ` | Račun: ${invoiceNumber}` : ''),
      document_date: this.parseDocumentDate(documentDate),
      store_name: receiverStore || customerName,
      responsible_person: responsiblePerson || null,
      invoice_number: invoiceNumber || null,
    });

    // Prevent duplicate imports for the same Pantheon document number (only when saving)
    let savedOrder: ShippingOrder | null = null as any;
    if (!previewOnly) {
      const existing = await this.orders.findOne({ where: { order_number: documentNumber } });
      if (existing) {
        throw new Error('Otprema sa ovim brojem već postoji');
      }
      savedOrder = await this.orders.save(order);
    }
    order.lines = [] as any;

    // Process items
    let itemsAdded = 0;
    let itemsCreated = 0;
    
    // Determine header and columns dynamically by scanning the first 30 rows
    let headerRowIdx = -1;
    let colSku = -1, colName = -1, colQty = -1, colUom = -1;
    try {
      const normalize = (s: any) => (s ?? '').toString().trim().toLowerCase();
      const has = (x: any, s: string) => ((x ?? '').toString().includes(s));
      for (let r = 0; r < Math.min(30, data.length); r++) {
        const row = data[r];
        if (!Array.isArray(row)) continue;
        const lower = row.map(normalize);
        const skuIdx = lower.findIndex((x: any) => has(x,'šifra') || has(x,'sifra') || has(x,'sku') || has(x,'šifra artikla') || has(x,'sifra artikla'));
        const nameIdx = lower.findIndex((x: any) => has(x,'naziv') || (has(x,'artikl') && !has(x,'šifra')));
        const qtyIdx = lower.findIndex((x: any) => has(x,'količ') || has(x,'kolic') || x === 'kol' || has(x,'qty'));
        const uomIdx = lower.findIndex((x: any) => has(x,'jmj') || has(x,'jed') || has(x,'uom') || x === 'jm');
        if ((skuIdx !== -1 && nameIdx !== -1 && qtyIdx !== -1) || (isPrenos && skuIdx !== -1 && nameIdx !== -1)) {
          headerRowIdx = r;
          colSku = skuIdx !== -1 ? skuIdx : colSku;
          colName = nameIdx !== -1 ? nameIdx : colName;
          colQty = qtyIdx !== -1 ? qtyIdx : colQty;
          colUom = uomIdx !== -1 ? uomIdx : colUom;
          break;
        }
      }
    } catch (err) {
      // fall back to fixed mapping
      headerRowIdx = -1;
    }

    // If header not found, fallback to previous fixed assumptions
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : (isPrenos ? 5 : 12);
    if (headerRowIdx < 0) {
      if (isPrenos) {
        colSku = 1; colName = 3; colQty = 11; colUom = -1;
      } else {
        colSku = 3; colName = 5; colQty = 9; colUom = 11;
      }
    }

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;

      // Check if row has data (non-null first element)
      const rowNum = row[0];
      if (!rowNum || (typeof rowNum !== 'string' && typeof rowNum !== 'number')) {
        continue;
      }

      // Skip "Ukupno:" or "Total:" rows
      if (typeof rowNum === 'string' && (rowNum.toLowerCase().includes('ukupno') || rowNum.toLowerCase().includes('total'))) {
        break;
      }

      let ident, itemName, quantity, unit;
      
      if (colSku !== -1 && colName !== -1 && colQty !== -1) {
        ident = row[colSku]?.toString().trim() || '';
        itemName = row[colName]?.toString().trim() || '';
        quantity = Number(row[colQty] || 0);
        const rawUom = colUom !== -1 ? (row[colUom]?.toString().trim() || '') : '';
        unit = rawUom && isNaN(Number(rawUom)) ? rawUom : 'KOM';
      } else if (isPrenos) {
        // Fallback PRENOS
        ident = row[1]?.toString().trim() || '';
        itemName = row[3]?.toString().trim() || '';
        quantity = Number(row[11] || 0);
        unit = 'KOM';
      } else {
        // Fallback PRIJEM
        ident = row[3]?.toString().trim() || '';
        itemName = row[5]?.toString().trim() || '';
        quantity = Number(row[9] || 0);
        unit = row[11]?.toString().trim() || 'KOM';
      }

      if (ident && itemName && quantity > 0) {
        // Find or create item (only create when saving, not during preview)
        let item = await this.items.findOne({ where: { sku: ident } });
        if (!item && !previewOnly) {
          const supId = await this.getDefaultSupplierId();
          item = this.items.create({
            sku: ident,
            name: itemName,
            supplier_id: supId,
            barcode: '',
          });
          item = await this.items.save(item);
          itemsCreated++;
        }

        // Add line to order or preview buffer
        if (previewOnly) {
          (order.lines as any).push({
            item: item ? { sku: item.sku, name: item.name } : { sku: ident, name: itemName },
            requested_qty: String(quantity),
            uom: unit,
          });
        } else {
          const line = this.lines.create({
            order: savedOrder,
            item: item,
            requested_qty: String(quantity),
            picked_qty: '0',
            uom: unit,
            pick_from_location_code: '',
            status_per_line: 'PENDING',
          });
          order.lines.push(line as any);
        }
        itemsAdded++;
      }
    }

    // For preview: return detected data without saving
    if (previewOnly) {
      const preview = order.lines.map((l: any) => ({
        item_sku: l.item?.sku || l.item_sku || '',
        item_name: l.item?.name || l.item_name || '',
        requested_qty: Number(l.requested_qty),
        uom: l.uom,
      }));
      return {
        preview: true,
        order_number: documentNumber,
        customer_name: receiverStore || customerName,
        issuer_name: issuerStore || null,
        responsible_person: responsiblePerson || null,
        document_date: documentDate,
        invoice_number: invoiceNumber || null,
        detected_columns: { header_row: startRow - 1, sku: colSku, name: colName, qty: colQty, uom: colUom },
        items_found: itemsAdded,
        lines: preview,
        message: `Pronađeno ${itemsAdded} stavki. Proverite i potvrdite import.`,
      };
    }

    // Save all lines
    if (order.lines.length > 0) {
      await this.lines.save(order.lines);
    }

    if (!previewOnly && savedOrder) {
      const assigneeSet = new Set<number>();
      if (savedOrder.assigned_user_id) assigneeSet.add(savedOrder.assigned_user_id);
      if (creator.id) assigneeSet.add(creator.id);
      await this.syncAssignees(savedOrder.id, Array.from(assigneeSet), savedOrder.assigned_team_id ?? null, creator.id);
      await this.updateAssigneeStatuses(savedOrder.id, savedOrder.status);
    }

    return {
      id: (savedOrder as any).id,
      order_number: (savedOrder as any).order_number,
      status: (savedOrder as any).status,
      issuer_name: issuerStore || null,
      customer_name: receiverStore || customerName,
      store_name: receiverStore || customerName,
      responsible_person: responsiblePerson || null,
      document_date: documentDate,
      invoice_number: invoiceNumber || null,
      items_created: itemsCreated,
      items_added: itemsAdded,
      message: `Uspješan import: kreiran nalog ${(savedOrder as any).order_number} sa ${itemsAdded} stavki`
    };
  }

  async importFromJson(body: any, userId: number) {
    try {
      const { order_number, customer_name, issuer_name, responsible_person, document_date, lines } = body || {};
      if (!Array.isArray(lines) || lines.length === 0) throw new Error('Nema stavki za import');
      if (!order_number) throw new Error('Nedostaje broj dokumenta');
      const existing = await this.orders.findOne({ where: { order_number }, relations: ['lines'] });

      const creator = await this.users.findOne({ where: { id: userId } });
      if (!creator) throw new ForbiddenException('Invalid user');

      let savedOrder: ShippingOrder;
      if (existing) {
        if (body?.overwrite === true || body?.force === true) {
          if (existing.lines && existing.lines.length) {
            await this.lines.remove(existing.lines);
          }
          savedOrder = existing;
        } else if (body?.append === true) {
          savedOrder = existing;
        } else {
          throw new Error('Otprema sa ovim brojem već postoji');
        }
        savedOrder.customer_name = customer_name || savedOrder.customer_name;
        savedOrder.document_date = this.parseDocumentDate(document_date) || savedOrder.document_date;
        savedOrder.store_name = (body.store_name || customer_name || savedOrder.store_name || '').toString();
        savedOrder.responsible_person = responsible_person || savedOrder.responsible_person;
        savedOrder.invoice_number = body.invoice_number?.toString?.().trim() || savedOrder.invoice_number || null;
      } else {
        const order = this.orders.create({
          order_number,
          customer_name: customer_name || '',
          status: 'DRAFT',
          created_by: creator,
          notes: [
            issuer_name ? `Izdavalac: ${issuer_name}` : null,
            customer_name ? `Primalac: ${customer_name}` : null,
            document_date ? `Datum: ${document_date}` : null,
            responsible_person ? `Odgovorna: ${responsible_person}` : null,
          ].filter(Boolean).join(' | '),
          document_date: this.parseDocumentDate(document_date),
          store_name: body.store_name || customer_name || null,
          responsible_person: responsible_person || null,
          invoice_number: body.invoice_number?.toString?.().trim() || null,
        });
        savedOrder = await this.orders.save(order);
      }
      const orderLines: ShippingOrderLine[] = [] as any;
      let itemsCreated = 0;
      for (const ln of lines) {
        const sku = (ln.item_sku ?? '').toString().trim();
        const name = (ln.item_name ?? '').toString().trim();
        const qty = Number(ln.requested_qty || 0);
        const uom = (ln.uom ?? 'KOM').toString();
        if (!sku || !name || qty <= 0) continue;
      let item = await this.items.findOne({ where: { sku } });
      if (!item) {
        const supId = await this.getDefaultSupplierId();
        item = await this.items.save(this.items.create({ sku, name, supplier_id: supId, barcode: '' }));
        itemsCreated++;
      }
        const line = this.lines.create({ order: savedOrder, item, requested_qty: String(qty), picked_qty: '0', uom, pick_from_location_code: '', status_per_line: 'PENDING', has_discrepancy: false, discrepancy_type: null, condition_notes: null });
        orderLines.push(line);
      }
      if (orderLines.length === 0) throw new Error('Nema validnih stavki');
      await this.lines.save(orderLines);
      // Make visible under Active orders
      savedOrder.status = 'PICKING';
      await this.orders.save(savedOrder);
      const assigneeSet = new Set<number>();
      if (savedOrder.assigned_user_id) assigneeSet.add(savedOrder.assigned_user_id);
      if (creator.id) assigneeSet.add(creator.id);
      await this.syncAssignees(savedOrder.id, Array.from(assigneeSet), savedOrder.assigned_team_id ?? null, creator.id);
      await this.updateAssigneeStatuses(savedOrder.id, savedOrder.status);
      return { id: savedOrder.id, order_number: savedOrder.order_number, status: savedOrder.status, document_date: savedOrder.document_date, store_name: savedOrder.store_name, responsible_person: savedOrder.responsible_person, invoice_number: savedOrder.invoice_number, items_created: itemsCreated, items_added: orderLines.length, message: `Uspješan import: kreiran nalog ${savedOrder.order_number} sa ${orderLines.length} stavki` };
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('importFromJson error:', msg);
      // Friendly mapping for common DB errors
      if (e?.code === '23505') {
        throw new Error('Otprema sa ovim brojem već postoji');
      }
      throw new Error(msg);
    }
  }

  private async fetchAssignmentMaps(orderIds: number[]) {
    if (!orderIds.length) {
      return { assignees: new Map<number, TaskAssignee[]>(), info: new Map<number, TaskAssignmentInfo>() };
    }
    const [assigneesRows, infoRows] = await Promise.all([
      this.taskAssignees.find({ where: { task_type: 'SHIPPING', task_id: In(orderIds) } as any }),
      this.taskAssignmentInfo.find({ where: { task_type: 'SHIPPING', task_id: In(orderIds) } as any }),
    ]);
    const assignees = new Map<number, TaskAssignee[]>();
    for (const row of assigneesRows) {
      const arr = assignees.get(row.task_id) || [];
      arr.push(row);
      assignees.set(row.task_id, arr);
    }
    const info = new Map<number, TaskAssignmentInfo>();
    for (const row of infoRows) {
      info.set(row.task_id, row);
    }
    return { assignees, info };
  }

  private formatAssignmentSummary(orderId: number, maps: { assignees: Map<number, TaskAssignee[]>; info: Map<number, TaskAssignmentInfo> }) {
    const assignees = maps.assignees.get(orderId) || [];
    const info = maps.info.get(orderId) || null;
    const names = assignees
      .map(a => a.user?.full_name || a.user?.name || a.user?.username)
      .filter(Boolean)
      .map(v => String(v));
    let summary: string | null = null;
    if (names.length) {
      summary = names.slice(0, 3).join(', ');
      if (names.length > 3) {
        summary += ` +${names.length - 3}`;
      }
    }
    let teamName: string | null = null;
    if (info?.team_id) {
      teamName = `Tim #${info.team_id}`;
    }
    return { summary, teamName };
  }

  private async logAudit(orderId: number, action: string, payload: Record<string, any>) {
    try {
      await this.auditRepo.insert({
        entity: 'ShippingOrder',
        entity_id: orderId,
        action,
        payload,
        actor_id: payload?.actor?.id ?? null,
      });
    } catch (error) {
      // Audit fallback – nemoj prekidati glavni flow
      console.warn('Audit log failed', error instanceof Error ? error.message : error);
    }
  }
}
