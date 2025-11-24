import { Injectable, BadRequestException, NotFoundException, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { ReceivingItem, ItemStatus } from '../entities/receiving-item.entity';
import { ReceivingPhoto } from '../entities/receiving-photo.entity';
import { Item } from '../entities/item.entity';
import { Supplier } from '../entities/supplier.entity';
import { User } from '../entities/user.entity';
import { Inventory } from '../entities/inventory.entity';
import { forwardRef } from '@nestjs/common';
import { PutawayOptimizerService } from '../putaway-optimizer/putaway-optimizer.service';
import { TaskAssignee, AssigneeStatus } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { PerformanceService } from '../performance/performance.service';
import { AssignmentsGateway } from '../workforce/assignments.gateway';
import { AuditLog } from '../entities/audit-log.entity';

function parseDocumentDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parts = normalized.split('-').map(part => part.trim());
  let isoCandidate = normalized;
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      isoCandidate = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    } else if (parts[2].length === 4) {
      isoCandidate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    const alt = new Date(raw);
    return Number.isNaN(alt.getTime()) ? null : alt;
  }
  return parsed;
}

@Injectable()
export class ReceivingService {
  // In-memory map for on-hold reasons (no DB schema changes in FAZA 3)
  private onHoldReasons: Map<number, string> = new Map();
  private computeLineStatus(it: ReceivingItem, docStatus: ReceivingStatus): 'U RADU' | 'SLOŽENO' | 'POTVRĐENO' {
    const qty = Number(it.received_quantity || 0);
    const hasQty = qty > 0;
    const hasLoc = !!it.location_id;
    if (!hasQty) return 'U RADU';
    if (hasQty && !hasLoc) return 'U RADU';
    if (docStatus === ReceivingStatus.COMPLETED) return 'POTVRĐENO';
    return 'SLOŽENO';
  }
  constructor(
    @InjectRepository(ReceivingDocument)
    private receivingDocumentRepository: Repository<ReceivingDocument>,
    @InjectRepository(ReceivingItem)
    private receivingItemRepository: Repository<ReceivingItem>,
    @InjectRepository(ReceivingPhoto)
    private receivingPhotoRepository: Repository<ReceivingPhoto>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(TaskAssignee)
    private taskAssigneeRepository: Repository<TaskAssignee>,
    @InjectRepository(TaskAssignmentInfo)
    private taskAssignmentInfoRepository: Repository<TaskAssignmentInfo>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    @Inject(forwardRef(() => PutawayOptimizerService))
    private putawayOptimizerService: PutawayOptimizerService,
    @Optional() private readonly performanceService?: PerformanceService,
    @Optional() @Inject(forwardRef(() => AssignmentsGateway))
    private readonly assignmentsWs?: AssignmentsGateway,
  ) {}

  private dashboardCache: { ts: number; data: any } | null = null;

  private async syncReceivingAssignees(documentId: number, assignedTo?: number | null, createdByUserId?: number | null) {
    const normalizedAssignee = (assignedTo !== undefined && assignedTo !== null && Number.isFinite(Number(assignedTo)))
      ? Number(assignedTo)
      : null;
    const info = await this.taskAssignmentInfoRepository.findOne({ where: { task_type: 'RECEIVING', task_id: documentId } as any });
    const assignees = await this.taskAssigneeRepository.find({ where: { task_type: 'RECEIVING', task_id: documentId } as any });

    if (normalizedAssignee === null) {
      if (!assignees.length || assignees.length > 1 || (info && info.team_id)) {
        return;
      }
      await this.taskAssigneeRepository.remove(assignees);
      if (info && !info.team_id && info.all_done_at) {
        info.all_done_at = null;
        await this.taskAssignmentInfoRepository.save(info);
      }
      return;
    }

    if (assignees.length > 1 || (info && info.team_id)) {
      // Team / multi-assignment is managed elsewhere (WorkforceService)
      return;
    }

    if (!info) {
      const newInfo = this.taskAssignmentInfoRepository.create({
        task_type: 'RECEIVING',
        task_id: documentId,
        policy: 'ANY_DONE',
        created_by_user_id: createdByUserId ?? null,
      });
      await this.taskAssignmentInfoRepository.save(newInfo);
    } else {
      let dirty = false;
      if (createdByUserId && !info.created_by_user_id) {
        info.created_by_user_id = createdByUserId;
        dirty = true;
      }
      if (info.all_done_at) {
        info.all_done_at = null;
        dirty = true;
      }
      if (dirty) {
        await this.taskAssignmentInfoRepository.save(info);
      }
    }

    if (!assignees.length) {
      const row = this.taskAssigneeRepository.create({
        task_type: 'RECEIVING',
        task_id: documentId,
        user_id: normalizedAssignee,
        status: 'ASSIGNED',
      });
      await this.taskAssigneeRepository.save(row);
      return;
    }

    const current = assignees[0];
    if (current.user_id === normalizedAssignee) {
      current.status = 'ASSIGNED';
      current.started_at = null;
      current.completed_at = null;
      await this.taskAssigneeRepository.save(current);
      return;
    }

    await this.taskAssigneeRepository.remove(current);
    const replacement = this.taskAssigneeRepository.create({
      task_type: 'RECEIVING',
      task_id: documentId,
      user_id: normalizedAssignee,
      status: 'ASSIGNED',
    });
    await this.taskAssigneeRepository.save(replacement);
  }

  private async setReceivingAssigneeStatus(documentId: number, status: AssigneeStatus) {
    const assignees = await this.taskAssigneeRepository.find({ where: { task_type: 'RECEIVING', task_id: documentId } as any });
    if (!assignees.length) return;
    const now = new Date();
    let changed = false;
    for (const row of assignees) {
      if (row.status === status) continue;
      row.status = status;
      if (status === 'ASSIGNED') {
        row.started_at = null;
        row.completed_at = null;
      } else if (status === 'IN_PROGRESS') {
        if (!row.started_at) row.started_at = now;
        row.completed_at = null;
      } else if (status === 'DONE') {
        if (!row.started_at) row.started_at = now;
        row.completed_at = now;
      }
      changed = true;
    }
    if (changed) {
      await this.taskAssigneeRepository.save(assignees);
    }

    const info = await this.taskAssignmentInfoRepository.findOne({ where: { task_type: 'RECEIVING', task_id: documentId } as any });
    if (!info || info.team_id) return;
    if (status === 'DONE') {
      if (!info.all_done_at) {
        info.all_done_at = now;
        await this.taskAssignmentInfoRepository.save(info);
      }
    } else if (info.all_done_at) {
      info.all_done_at = null;
      await this.taskAssignmentInfoRepository.save(info);
    }
  }

  async recommendLocation(receivingItemId: number, userId: number, userRole: string) {
    const suggestion = await this.putawayOptimizerService.getSuggestions(receivingItemId, userId, userRole);
    
    const receivingItem = await this.receivingItemRepository.findOne({
      where: { id: receivingItemId },
      relations: ['item'],
    });

    if (!receivingItem) {
      throw new NotFoundException('Receiving item not found');
    }

    const item = receivingItem.item;
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Determine safety requirements
    const itemWeight = (item as any).weight_kg ? parseFloat(String((item as any).weight_kg)) : null;
    const itemLength = (item as any).length_mm ? parseFloat(String((item as any).length_mm)) : null;
    const safety: string[] = [];

    if (itemWeight && itemWeight > 50) {
      safety.push('TEŠKO');
    }
    if (itemLength && itemLength > 3000) {
      safety.push('VISINA >1.8m');
    }
    if (itemWeight && itemWeight > 30) {
      safety.push('OPREZ RUKAVICE');
    }

    // Get location details for recommended location
    const bestLocation = suggestion.best_choice;
    const bestCandidate = suggestion.candidates[0];

    // Extract safety flags from candidate
    if (bestCandidate?.safety_flag) {
      safety.push(bestCandidate.safety_flag);
    }

    const notes = (item as any).notes || null;

    return {
      item_sku: item.sku,
      recommended_location: bestLocation || null,
      alternatives: suggestion.candidates.slice(1, 4).map(c => c.location_code),
      safety: safety.length > 0 ? safety : [],
      notes: notes,
    };
  }

  async createDocument(data: {
    document_number: string;
    supplier_id: number;
    pantheon_invoice_number: string;
    assigned_to?: number;
    notes?: string;
    document_date?: string | Date | null;
    store_name?: string | null;
    responsible_person?: string | null;
    invoice_number?: string | null;
    created_by?: number | null;
  }) {
    // Basic validation with user-friendly messages
    if (!data.document_number || !data.document_number.trim()) {
      throw new BadRequestException('Broj dokumenta je obavezan.');
    }
    if (!data.supplier_id || Number.isNaN(Number(data.supplier_id))) {
      throw new BadRequestException('Dobavljač je obavezan.');
    }
    const assignedTo = (data.assigned_to !== undefined && data.assigned_to !== null && !Number.isNaN(Number(data.assigned_to)))
      ? Number(data.assigned_to)
      : null;
    const createdBy = (data.created_by !== undefined && data.created_by !== null && !Number.isNaN(Number(data.created_by)))
      ? Number(data.created_by)
      : null;

    const document = this.receivingDocumentRepository.create({
      document_number: data.document_number,
      supplier_id: data.supplier_id,
      pantheon_invoice_number: data.pantheon_invoice_number,
      notes: data.notes,
      assigned_to: assignedTo,
      received_by: null,
      created_by: createdBy,
      status: ReceivingStatus.DRAFT,
      document_date: parseDocumentDate(data.document_date),
      store_name: data.store_name?.toString?.().trim() || null,
      responsible_person: data.responsible_person?.toString?.().trim() || null,
      invoice_number: data.invoice_number?.toString?.().trim() || null,
    });
    try {
      const saved = await this.receivingDocumentRepository.save(document);
      await this.syncReceivingAssignees(saved.id, assignedTo, createdBy);

      if (this.assignmentsWs) {
        let assignedName: string | undefined;
        if (assignedTo) {
          const assignedUser = await this.userRepository.findOne({ where: { id: assignedTo } });
          assignedName = (assignedUser as any)?.full_name || assignedUser?.name || assignedUser?.username || undefined;
        }
        let supplierName: string | undefined;
        if (saved.supplier_id) {
          const supplier = await this.supplierRepository.findOne({ where: { id: saved.supplier_id } });
          supplierName = supplier?.name || undefined;
        }
        const creatorUser = createdBy
          ? await this.userRepository.findOne({ where: { id: createdBy } })
          : null;
        this.assignmentsWs.broadcastTaskCreated({
          type: 'RECEIVING',
          task_id: saved.id,
          document_number: saved.document_number,
          supplier_name: supplierName,
          created_by_id: createdBy || undefined,
          created_by_name: creatorUser ? ((creatorUser as any).full_name || creatorUser.name || creatorUser.username) : undefined,
          created_at: saved.created_at,
          store_name: saved.store_name || undefined,
        });
      }
      // Log CREATE action
      await this.logAudit(saved.id, 'CREATE', {
        actor: createdBy ? { id: createdBy } : null,
        document_number: saved.document_number,
        supplier_id: saved.supplier_id,
        assigned_to: saved.assigned_to,
      });
      return saved;
    } catch (err: any) {
      // Handle common DB errors gracefully
      if (err && err.code === '23505') {
        // Unique violation
        throw new BadRequestException('Broj dokumenta već postoji. Izaberite drugi broj.');
      }
      if (err && err.code === '23503') {
        // Foreign key violation (e.g., assigned_to or supplier_id not found)
        throw new BadRequestException('Pogrešan korisnik ili dobavljač. Proverite dodelu i dobavljača.');
      }
      throw new BadRequestException(err?.message || 'Neuspešno kreiranje prijema. Proverite podatke.');
    }
  }

  async getAllDocuments(userRole: string, userId?: number) {
    const queryBuilder = this.receivingDocumentRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.supplier', 'supplier')
      .leftJoinAndSelect('document.assignedUser', 'assignedUser')
      .leftJoinAndSelect('document.createdBy', 'createdBy')
      .leftJoinAndSelect('document.items', 'items')
      .leftJoinAndSelect('items.item', 'item');

    // RBAC: Magacioneri see only assigned documents
    // Komercijalista and logistika see only documents they created
    // Admin/menadzer/sef see all documents
    if (userRole === 'magacioner' && userId) {
      queryBuilder.where('document.assigned_to = :userId', { userId });
    } else if (['komercijalista', 'logistika'].includes(userRole) && userId) {
      // For now, these roles see all - can be restricted later if needed
      // They can create but not assign
    }

    const docs = await queryBuilder.getMany();
    const docIds = docs.map(d => d.id);
    const [assigneesRows, infoRows] = docIds.length ? await Promise.all([
      this.taskAssigneeRepository.find({ where: { task_type: 'RECEIVING', task_id: In(docIds) } as any }),
      this.taskAssignmentInfoRepository.find({ where: { task_type: 'RECEIVING', task_id: In(docIds) } as any }),
    ]) : [[], []];
    const assigneesByDoc = new Map<number, TaskAssignee[]>();
    assigneesRows.forEach(row => {
      const arr = assigneesByDoc.get(row.task_id) || [];
      arr.push(row);
      assigneesByDoc.set(row.task_id, arr);
    });
    const infoByDoc = new Map<number, TaskAssignmentInfo>();
    infoRows.forEach(info => infoByDoc.set(info.task_id, info));

    const docsWithMeta = docs.map(d => {
      const items = d.items || [];
      const documentDate = d.document_date instanceof Date ? d.document_date.toISOString().split('T')[0] : d.document_date;
      const assignees = assigneesByDoc.get(d.id) || [];
      const info = infoByDoc.get(d.id) || null;
      let assignedSummary: string | null = null;
      let assignedTeamName: string | null = null;
      if (assignees.length > 0) {
        const names = assignees
          .map(a => a.user?.full_name || a.user?.name || a.user?.username)
          .filter(Boolean)
          .map(name => String(name))
          .slice(0, 3);
        assignedSummary = names.join(', ');
        if (assignees.length > names.length) {
          assignedSummary += ` +${assignees.length - names.length}`;
        }
      }
      if (info && info.team_id) {
        assignedTeamName = `Tim #${info.team_id}`;
      }
      const linesTotal = items.length;
      const linesReceived = items.filter(it => Number(it.received_quantity || 0) > 0).length;
      const qtyExpectedTotal = items.reduce((sum, it) => sum + Number(it.expected_quantity || 0), 0);
      const qtyReceivedTotal = items.reduce((sum, it) => sum + Number(it.received_quantity || 0), 0);
      const progressPct = linesTotal > 0 ? Math.round((linesReceived / linesTotal) * 100) : 0;
      const startedAt = d.started_at || d.created_at;
      const endRef = d.completed_at || new Date();
      const ageMinutes = startedAt ? Math.max(0, Math.floor((new Date(endRef).getTime() - new Date(startedAt).getTime()) / 60000)) : 0;
      return {
        ...d,
        document_date: documentDate,
        store_name: d.store_name,
        responsible_person: d.responsible_person,
        invoice_number: d.invoice_number,
        created_by: d.created_by,
        createdBy: d.createdBy,
        assigned_summary: assignedSummary,
        assigned_team_name: assignedTeamName,
        progress_pct: progressPct,
        lines_total: linesTotal,
        lines_received: linesReceived,
        qty_expected_total: qtyExpectedTotal,
        qty_received_total: qtyReceivedTotal,
        age_minutes: ageMinutes,
        items: items.map(it => ({
          ...it,
          computed_status: this.computeLineStatus(it, d.status),
        })),
      };
    });
    return docsWithMeta;
  }

  async getActiveReceivings() {
    // Fetch documents in progress or on hold with relations needed for names
    const docs = await this.receivingDocumentRepository.find({
      where: [
        { status: ReceivingStatus.IN_PROGRESS },
        { status: ReceivingStatus.ON_HOLD },
        { status: ReceivingStatus.DRAFT },
      ],
      relations: ['supplier', 'assignedUser'],
      order: { id: 'DESC' },
    });

    // Compute aggregates per document
    const results = [] as any[];
    const now = Date.now();
    for (const d of docs) {
      const items = await this.receivingItemRepository.find({ where: { receiving_document_id: d.id } });
      const totalItems = items.length;
      const receivedItemsCount = items.filter(it => (it.received_quantity || 0) > 0).length;
      const percentComplete = totalItems > 0 ? Math.round((receivedItemsCount / totalItems) * 100) : 0;
      const statuses = items.map(it => this.computeLineStatus(it, d.status));
      const hasInProgress = statuses.includes('U RADU');
      const allPlaced = statuses.length > 0 && statuses.every(s => s === 'SLOŽENO');
      const recent = items.some(it => it.updated_at && (now - new Date(it.updated_at).getTime()) < 5 * 60 * 1000);
      results.push({
        id: d.id,
        document_number: d.document_number,
        supplier_name: d.supplier?.name || '',
        assigned_user_name: d.assignedUser?.name || '',
        status: d.status,
        started_at: d.created_at, // proxy for started time
        total_items: totalItems,
        received_items_count: receivedItemsCount,
        percent_complete: percentComplete,
        on_hold_reason: this.onHoldReasons.get(d.id) || null,
        has_in_progress_items: hasInProgress,
        all_items_placed: allPlaced,
        is_completed: d.status === ReceivingStatus.COMPLETED,
        recent_activity: recent,
      });
    }
    return results;
  }

  async getDashboardSnapshot() {
    const now = Date.now();
    if (this.dashboardCache && now - this.dashboardCache.ts < 5000) {
      return this.dashboardCache.data;
    }
    const docs = await this.receivingDocumentRepository.find({
      where: [
        { status: ReceivingStatus.IN_PROGRESS },
        { status: ReceivingStatus.ON_HOLD },
      ],
      relations: ['supplier', 'assignedUser'],
      order: { id: 'DESC' },
    });
    const workers = await this.userRepository.find({ where: { role: 'magacioner', is_active: true } });
    const resultReceivings: any[] = [];
    const byWorker: Map<number, any[]> = new Map();
    const nowDate = new Date();
    for (const d of docs) {
      const items = await this.receivingItemRepository.find({ where: { receiving_document_id: d.id } });
      const total = items.length || 0;
      const done = items.filter(it => (it.received_quantity || 0) > 0).length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      const startedAt = d.started_at || d.created_at;
      const elapsedMinutes = Math.max(0, Math.round((nowDate.getTime() - new Date(startedAt).getTime()) / 60000));
      const onHoldReason = this.onHoldReasons.get(d.id) || null;
      const rec = {
        id: d.id,
        document_number: d.document_number,
        supplier_name: d.supplier?.name || '',
        assigned_user_name: d.assignedUser?.name || '',
        started_at: startedAt,
        status: d.status,
        percent_complete: percent,
        elapsed_minutes: elapsedMinutes,
        on_hold_reason: onHoldReason,
        warnings: {
          slow_progress: elapsedMinutes > 60 && percent < 50,
          blocked: !!onHoldReason,
        }
      };
      resultReceivings.push(rec);
      const wid = d.assigned_to;
      if (!byWorker.has(wid)) byWorker.set(wid, []);
      byWorker.get(wid).push(rec);
    }
    const resultWorkers: any[] = [];
    for (const w of workers) {
      const list = byWorker.get(w.id) || [];
      const activeCount = list.length;
      const avg = activeCount > 0 ? Math.round(list.reduce((s, r: any) => s + (r.percent_complete || 0), 0) / activeCount) : 0;
      const last = w.last_activity || w.updated_at || w.created_at;
      const mins = Math.round((nowDate.getTime() - new Date(last).getTime()) / 60000);
      let status: 'ACTIVE'|'BUSY'|'IDLE' = 'ACTIVE';
      if (mins > 10) status = 'IDLE';
      else if (avg >= 80) status = 'BUSY';
      resultWorkers.push({
        id: w.id,
        name: w.name,
        shift: 'Prva',
        active_receivings: activeCount,
        percent_total: avg,
        last_activity: last,
        status,
        warnings: { idle: mins > 30 }
      });
    }
    const payload = {
      timestamp: new Date().toISOString(),
      workers: resultWorkers,
      receivings: resultReceivings,
    };
    this.dashboardCache = { ts: now, data: payload };
    return payload;
  }

  async getDocumentById(id: number) {
    const d = await this.receivingDocumentRepository.findOne({
      where: { id },
      relations: ['supplier', 'assignedUser', 'createdBy', 'items', 'items.item', 'photos'],
    });
    if (!d) return d;
    const documentDate = d.document_date instanceof Date ? d.document_date.toISOString().split('T')[0] : d.document_date;
    const assignees = await this.taskAssigneeRepository.find({ where: { task_type: 'RECEIVING', task_id: id } as any });
    const info = await this.taskAssignmentInfoRepository.findOne({ where: { task_type: 'RECEIVING', task_id: id } as any });
    const names = assignees.map(a => a.user?.full_name || a.user?.name || a.user?.username).filter(Boolean).map(name => String(name));
    const details = info && info.team_id ? `Tim #${info.team_id}${names.length ? ` (${names.join(', ')})` : ''}` : names.join(', ');
    return {
      ...d,
      document_date: documentDate,
      store_name: d.store_name,
      responsible_person: d.responsible_person,
      invoice_number: d.invoice_number,
      created_by: d.created_by,
      createdBy: d.createdBy,
      assigned_summary: names.length ? names.join(', ') : null,
      assigned_team_name: info && info.team_id ? `Tim #${info.team_id}` : null,
      assigned_details: details || null,
      items: (d.items || []).map(it => ({
        ...it,
        computed_status: this.computeLineStatus(it, d.status),
      })),
    } as any;
  }

  async addItemToDocument(documentId: number, itemId: number, expectedQuantity: number, barcode?: string) {
    // Friendly validations to avoid 500s
    if (!documentId || Number.isNaN(Number(documentId))) {
      throw new BadRequestException('Nedostaje važeći ID prijema.');
    }
    if (!itemId || Number.isNaN(Number(itemId))) {
      throw new BadRequestException('Nedostaje važeći ID artikla.');
    }
    const qty = Number(expectedQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('Količina mora biti veća od 0.');
    }

    const [doc, itm] = await Promise.all([
      this.receivingDocumentRepository.findOne({ where: { id: documentId } }),
      this.itemRepository.findOne({ where: { id: itemId } }),
    ]);
    if (!doc) throw new BadRequestException('Prijem ne postoji.');
    if (!itm) throw new BadRequestException('Artikal ne postoji.');

    try {
      const recItem = this.receivingItemRepository.create({
        receiving_document_id: documentId,
        item_id: itemId,
        expected_quantity: qty,
        barcode,
        status: ItemStatus.PENDING,
      });
      return await this.receivingItemRepository.save(recItem);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Neuspešno dodavanje stavke u prijem.');
    }
  }

  async updateItem(id: number, data: {
    received_quantity?: number;
    status?: ItemStatus;
    location_id?: number;
    pallet_id?: string;
    condition_notes?: string;
  }) {
    const item = await this.receivingItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new Error('Item not found');
    }
    const parent = await this.receivingDocumentRepository.findOne({ where: { id: item.receiving_document_id } });
    if (parent && parent.status === ReceivingStatus.COMPLETED) {
      throw new BadRequestException('Dokument je završen i više nije moguće menjati stavke.');
    }
    Object.assign(item, data);
    const saved = await this.receivingItemRepository.save(item);
    if (this.performanceService) {
      this.performanceService.triggerRefresh('receiving-item').catch(() => undefined);
    }
    return saved;
  }

  async getItemById(id: number) {
    return await this.receivingItemRepository.findOne({
      where: { id },
      relations: ['item', 'receivingDocument', 'location'],
    });
  }

  async uploadPhoto(documentId: number, photoUrl: string, userId: number, caption?: string, itemId?: number) {
    // RBAC: magacioner sme samo za svoj dokument i ako nije completed
    const doc = await this.receivingDocumentRepository.findOne({ where: { id: documentId } });
    if (!doc) throw new BadRequestException('Prijem ne postoji.');
    // Note: we cannot read role here unless passed via controller; uploadPhotoFile passes req.user to controller only.
    // Security checks are done in moveUploadedPhotoToDocumentDir and controller-level guards, but enforce basic checks here if possible.
    const photo = this.receivingPhotoRepository.create({
      receiving_document_id: documentId,
      item_id: itemId,
      photo_url: photoUrl,
      uploaded_by: userId,
      caption,
      note: caption,
    });
    return await this.receivingPhotoRepository.save(photo);
  }

  // Move uploaded temp file into /uploads/receiving/<document_number>/
  async moveUploadedPhotoToDocumentDir(documentId: number, file: { path?: string; filename: string; mimetype: string }): Promise<{ webPath: string; fsPath: string }> {
    const doc = await this.receivingDocumentRepository.findOne({ where: { id: documentId } });
    if (!doc) throw new BadRequestException('Prijem ne postoji.');
    const base = process.cwd();
    const safeDocNo = (doc.document_number || String(documentId)).replace(/[^A-Za-z0-9_\-]/g, '_');
    const dir = require('path').join(base, 'uploads', 'receiving', safeDocNo);
    const fs = require('fs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const src = require('path').join(base, 'uploads', file.filename);
    const dst = require('path').join(dir, unique);
    try {
      fs.renameSync(src, dst);
    } catch (e) {
      // fallback copy
      fs.copyFileSync(src, dst);
      try { fs.unlinkSync(src); } catch {}
    }
    const webPath = `/uploads/receiving/${safeDocNo}/${unique}`;
    return { webPath, fsPath: dst };
  }

  async ensureCanUpload(actor: { id: number; role: string }, documentId: number) {
    const doc = await this.receivingDocumentRepository.findOne({ where: { id: documentId } });
    if (!doc) throw new BadRequestException('Prijem ne postoji.');
    const admin = ['admin','menadzer','sef','sef_magacina'].includes(actor.role);
    if (!admin) {
      if (actor.role !== 'magacioner' || doc.assigned_to !== actor.id || doc.status === ReceivingStatus.COMPLETED) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException('Ovaj prijem nije dodeljen vama ili je već završen.');
      }
    }
  }

  async getDocumentPhotos(actor: { id: number; role: string }, documentId: number) {
    const doc = await this.receivingDocumentRepository.findOne({ where: { id: documentId } });
    if (!doc) throw new BadRequestException('Prijem ne postoji.');
    const admin = ['admin','menadzer','sef','sef_magacina'].includes(actor.role);
    if (!admin) {
      if (!(actor.role === 'magacioner' && doc.assigned_to === actor.id && doc.status !== ReceivingStatus.COMPLETED)) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException('Ne možete videti foto evidenciju za ovaj prijem.');
      }
    }
    // Build listing with joins for item SKU/name and uploader
    const rows = await this.receivingPhotoRepository
      .createQueryBuilder('p')
      .leftJoin('receiving_items', 'ri', 'ri.id = p.item_id')
      .leftJoin('items', 'it', 'it.id = ri.item_id')
      .leftJoin('users', 'u', 'u.id = p.uploaded_by')
      .select([
        'p.id AS id',
        'p.photo_url AS file_path',
        'p.caption AS note',
        'p.created_at AS uploaded_at',
        'p.item_id AS receiving_item_id',
        "(u.name) AS uploaded_by_name",
        'ri.id AS ri_id',
        'it.sku AS sku',
        'it.name AS item_name',
      ])
      .where('p.receiving_document_id = :docId', { docId: documentId })
      .orderBy('p.id', 'DESC')
      .getRawMany();

    return rows.map(r => ({
      id: Number(r.id),
      file_path: r.file_path,
      note: r.note || null,
      uploaded_at: r.uploaded_at,
      uploaded_by: r.uploaded_by_name || '',
      receiving_item: r.ri_id ? { id: Number(r.ri_id), sku: r.sku, name: r.item_name } : null,
    }));
  }

  async startDocument(id: number, assignedToUserId?: number, actor?: { id: number; role: string }) {
    const document = await this.receivingDocumentRepository.findOne({ where: { id } });
    if (!document) {
      throw new Error('Document not found');
    }
    const isAdmin = actor && ['admin', 'menadzer', 'sef', 'sef_magacina'].includes(actor.role);
    const isMag = actor?.role === 'magacioner';

    if (isAdmin) {
      // Admins can start any draft and optionally reassign
      if (document.status !== ReceivingStatus.DRAFT) {
        // idempotent: if already in progress, return current state
        return document;
      }
      document.status = ReceivingStatus.IN_PROGRESS;
      document.started_at = new Date();
      if (assignedToUserId && !Number.isNaN(assignedToUserId)) {
        document.assigned_to = assignedToUserId;
      }
      const saved = await this.receivingDocumentRepository.save(document);
      await this.syncReceivingAssignees(saved.id, saved.assigned_to ?? assignedToUserId ?? null, actor?.id);
      await this.setReceivingAssigneeStatus(saved.id, 'IN_PROGRESS');
      // Log START action
      await this.logAudit(saved.id, 'START', {
        actor: actor ? { id: actor.id, role: actor.role } : null,
        document_number: saved.document_number,
        assigned_to: saved.assigned_to,
      });
      return { status: saved.status, document_id: saved.id, document_number: saved.document_number, started_at: saved.started_at } as any;
    }

    if (isMag) {
      const notDraft = document.status !== ReceivingStatus.DRAFT;
      const isHold = document.status === ReceivingStatus.ON_HOLD;
      if (notDraft || document.assigned_to !== actor.id || isHold) {
        // Forbidden for magacioner
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException('Ovaj prijem nije dodeljen vama ili nije u nacrtu.');
      }
      document.status = ReceivingStatus.IN_PROGRESS;
      document.started_at = new Date();
      const saved = await this.receivingDocumentRepository.save(document);
      await this.syncReceivingAssignees(saved.id, saved.assigned_to ?? actor?.id ?? null, actor?.id);
      await this.setReceivingAssigneeStatus(saved.id, 'IN_PROGRESS');
      // Log START action
      await this.logAudit(saved.id, 'START', {
        actor: actor ? { id: actor.id, role: actor.role } : null,
        document_number: saved.document_number,
        assigned_to: saved.assigned_to,
      });
      return { status: saved.status, document_id: saved.id, document_number: saved.document_number, started_at: saved.started_at } as any;
    }

    return document;
  }

  async completeDocument(id: number, actor?: { id: number; role: string }) {
    const document = await this.receivingDocumentRepository.findOne({ where: { id } });
    if (!document) {
      throw new Error('Document not found');
    }
    if (actor) {
      const allowed = ['admin', 'menadzer', 'sef', 'sef_magacina'];
      if (!allowed.includes(actor.role)) {
        if (!(actor.role === 'magacioner' && document.assigned_to === actor.id)) {
          const { ForbiddenException } = await import('@nestjs/common');
          throw new ForbiddenException('Ovaj prijem nije dodeljen vama.');
        }
      }
    }
    if (document.status === ReceivingStatus.ON_HOLD) {
      throw new Error('Dokument je na čekanju i ne može biti završen');
    }
    const items = await this.receivingItemRepository.find({ where: { receiving_document_id: id }, relations: ['item'] });
    
    // LOKACIJE DISABLED - Za sada ne koristimo lokacije, može se završiti prijem bez lokacija
    // Preskačemo validaciju lokacija
    
    // Log inventory movements
    const candidateAssignee = document.assigned_to ?? (actor?.role === 'magacioner' ? actor.id : null);
    if (!document.assigned_to && candidateAssignee) {
      document.assigned_to = candidateAssignee;
    }
    if (actor?.id) {
      document.received_by = actor.id;
    } else if (!document.received_by && candidateAssignee) {
      document.received_by = candidateAssignee;
    }
    const movementActorId = actor?.id
      ?? document.received_by
      ?? document.assigned_to
      ?? document.created_by
      ?? 1;

    await this.syncReceivingAssignees(document.id, document.assigned_to ?? candidateAssignee ?? null, actor?.id ?? document.created_by ?? null);

    for (const it of items) {
      const recv = Number(it.received_quantity || 0);
      if (recv <= 0) continue;

      if (it.location_id && it.location_id !== null) {
        let row = await this.inventoryRepository.findOne({ where: { item_id: it.item_id, location_id: it.location_id } });
        if (!row) {
          row = this.inventoryRepository.create({ item_id: it.item_id, location_id: it.location_id, quantity: String(recv) });
        } else {
          const current = parseFloat(row.quantity as any) || 0;
          row.quantity = String(current + recv);
        }
        await this.inventoryRepository.save(row);
      }

      await this.receivingItemRepository.manager.query(
        `INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [it.item_id, null, it.location_id ?? null, recv, 'PRIJEM', id, movementActorId]
      );
    }
    document.status = ReceivingStatus.COMPLETED;
    document.completed_at = new Date();
    const saved = await this.receivingDocumentRepository.save(document);
    await this.setReceivingAssigneeStatus(saved.id, 'DONE');
    
    // Get assignment info to determine if it's a team or individual assignment
    const assignmentInfo = await this.taskAssignmentInfoRepository.findOne({ where: { task_type: 'RECEIVING', task_id: saved.id } as any });
    const assignees = await this.taskAssigneeRepository.find({ where: { task_type: 'RECEIVING', task_id: saved.id } as any });
    
    // Get worker/team info for notification
    let workerId: number | undefined;
    let workerName: string | undefined;
    let teamId: number | undefined;
    let teamName: string | undefined;
    
    if (assignmentInfo?.team_id) {
      teamId = assignmentInfo.team_id;
      // Team name will be resolved in WorkforceService if needed
    } else if (assignees.length > 0) {
      const assignee = assignees[0];
      workerId = assignee.user_id;
      const user = await this.userRepository.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    } else if (saved.assigned_to) {
      workerId = saved.assigned_to;
      const user = await this.userRepository.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    }
    
    // Broadcast task completion notification
    if (this.assignmentsWs) {
      try {
        this.assignmentsWs.broadcastTaskCompleted({
          type: 'RECEIVING',
          task_id: saved.id,
          document_number: saved.document_number,
          worker_id: workerId,
          worker_name: workerName,
          team_id: teamId,
          team_name: teamName,
          completed_at: saved.completed_at,
        });
      } catch (e) {
        // Ignore WebSocket errors
      }
    }
    
    // Log COMPLETE action
    await this.logAudit(saved.id, 'COMPLETE', {
      actor: actor ? { id: actor.id, role: actor.role } : null,
      document_number: saved.document_number,
      items_count: items.length,
      items_received: items.filter(i => (i.received_quantity || 0) > 0).length,
    });

    if (this.performanceService) {
      this.performanceService.triggerRefresh('receiving-complete').catch(() => undefined);
    }
    return { 
      status: 'completed',
      document_id: saved.id,
      document_number: saved.document_number,
      completed_at: saved.completed_at,
      items_updated: items.filter(i => (i.received_quantity || 0) > 0).length,
      message: 'Prijem završen. Zalihe ažurirane.'
    } as any;
  }

  async getMyActive(actor: { id: number; role: string }, userIdOverride?: number) {
    // RBAC: komercijalista nema pristup
    if (actor.role === 'komercijalista') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Nemate pristup ovoj funkciji.');
    }
    const targetUserId = ['admin','menadzer','sef','sef_magacina'].includes(actor.role) && userIdOverride ? userIdOverride : actor.id;
    
    // Get documents assigned via TaskAssignee table (new system) OR via assigned_to field (legacy)
    const assigneeDocs = await this.taskAssigneeRepository.find({
      where: {
        task_type: 'RECEIVING',
        user_id: targetUserId,
        status: In(['ASSIGNED', 'IN_PROGRESS']),
      } as any,
    });
    const assignedDocIds = assigneeDocs.map(a => a.task_id);
    
    // Also check legacy assigned_to field
    const legacyDocs = await this.receivingDocumentRepository.find({
      where: [
        { assigned_to: targetUserId, status: ReceivingStatus.DRAFT },
        { assigned_to: targetUserId, status: ReceivingStatus.IN_PROGRESS },
        { assigned_to: targetUserId, status: ReceivingStatus.ON_HOLD },
      ],
      select: ['id'],
    });
    const legacyDocIds = legacyDocs.map(d => d.id);
    
    // Combine both sets of document IDs
    const allDocIds = [...new Set([...assignedDocIds, ...legacyDocIds])];
    
    if (allDocIds.length === 0) {
      return [];
    }
    
    // Fetch full documents with relations
    const docs = await this.receivingDocumentRepository.find({
      where: {
        id: In(allDocIds),
        status: In([ReceivingStatus.DRAFT, ReceivingStatus.IN_PROGRESS, ReceivingStatus.ON_HOLD]),
      },
      relations: ['supplier'],
      order: { id: 'DESC' },
    });

    // Preload all items in one query for better performance
    const allItems = docs.length > 0 
      ? await this.receivingItemRepository.find({ 
          where: { receiving_document_id: In(docs.map(d => d.id)) } 
        })
      : [];
    const itemsByDocId = new Map<number, typeof allItems>();
    allItems.forEach(item => {
      const arr = itemsByDocId.get(item.receiving_document_id) || [];
      arr.push(item);
      itemsByDocId.set(item.receiving_document_id, arr);
    });

    const out: any[] = [];
    const now = Date.now();
    for (const d of docs) {
      const items = itemsByDocId.get(d.id) || [];
      const total = items.length || 0;
      const ok = items.filter(it => (Number(it.received_quantity || 0) > 0) && !!it.location_id).length;
      const progress = total > 0 ? Math.round((ok / total) * 100) : 0;
      // recent activity flag (placeholder): any item updated in last 5 minutes
      const recent = items.some(it => it.updated_at && (now - new Date(it.updated_at).getTime()) < 5 * 60 * 1000);
      out.push({
        id: d.id,
        document_number: d.document_number,
        supplier_name: d.supplier?.name || '',
        status: d.status,
        progress,
        started_at: d.started_at,
        recent_activity: recent,
      });
    }
    return out;
  }

  async setHold(id: number, hold: boolean, reason?: string, actor?: { id: number; role: string }) {
    const document = await this.receivingDocumentRepository.findOne({ where: { id } });
    if (!document) throw new Error('Document not found');
    document.status = hold ? ReceivingStatus.ON_HOLD : ReceivingStatus.DRAFT;
    if (hold) {
      if (reason) this.onHoldReasons.set(id, reason);
      // Log HOLD action
      await this.logAudit(id, 'HOLD', {
        actor: actor ? { id: actor.id, role: actor.role } : null,
        document_number: document.document_number,
        reason: reason || null,
      });
    } else {
      this.onHoldReasons.delete(id);
      // Log RESUME action
      await this.logAudit(id, 'RESUME', {
        actor: actor ? { id: actor.id, role: actor.role } : null,
        document_number: document.document_number,
      });
    }
    return await this.receivingDocumentRepository.save(document);
  }

  async getStats() {
    const total = await this.receivingDocumentRepository.count();
    const draft = await this.receivingDocumentRepository.count({ where: { status: ReceivingStatus.DRAFT } });
    const inProgress = await this.receivingDocumentRepository.count({ where: { status: ReceivingStatus.IN_PROGRESS } });
    const completed = await this.receivingDocumentRepository.count({ where: { status: ReceivingStatus.COMPLETED } });

    return { total, draft, in_progress: inProgress, completed };
  }

  async getTodayStats() {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);
    const qb = this.receivingDocumentRepository.createQueryBuilder('d')
      .where('d.created_at BETWEEN :start AND :end', { start, end });
    const total = await qb.getCount();
    const inProgress = await this.receivingDocumentRepository.count({ where: { status: ReceivingStatus.IN_PROGRESS } });
    const completed = await this.receivingDocumentRepository.count({ where: { status: ReceivingStatus.COMPLETED } });
    return { total_today: total, in_progress_today: inProgress, completed_today: completed, from: start, to: end };
  }

  async deleteDocument(id: number, actor?: { id: number; role: string }) {
    const document = await this.receivingDocumentRepository.findOne({ where: { id } });
    // Log DELETE action before deletion
    if (document) {
      await this.logAudit(id, 'DELETE', {
        actor: actor ? { id: actor.id, role: actor.role } : null,
        document_number: document.document_number,
      });
    }
    // Delete all items first
    await this.receivingItemRepository.delete({ receiving_document_id: id });
    // Delete all photos
    await this.receivingPhotoRepository.delete({ receiving_document_id: id });
    // Delete task assignments
    await this.taskAssigneeRepository.delete({ task_type: 'RECEIVING', task_id: id } as any);
    await this.taskAssignmentInfoRepository.delete({ task_type: 'RECEIVING', task_id: id } as any);
    // Then delete document
    return await this.receivingDocumentRepository.delete(id);
  }

  async deleteDocumentsBulk(documentIds: number[], actor?: { id: number; role: string }) {
    const results = { deleted: 0, skipped: 0, errors: [] as string[] };
    
    for (const id of documentIds) {
      try {
        await this.deleteDocument(id, actor);
        results.deleted++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(`Dokument ${id}: ${e?.message || 'Nepoznata greška'}`);
      }
    }

    return results;
  }

  private async logAudit(documentId: number, action: string, payload: Record<string, any>) {
    try {
      await this.auditRepo.insert({
        entity: 'ReceivingDocument',
        entity_id: documentId,
        action,
        payload,
        actor_id: payload?.actor?.id ?? null,
      });
    } catch (error) {
      // Audit fallback – nemoj prekidati glavni flow
      console.warn('Audit log failed', error instanceof Error ? error.message : error);
    }
  }

  async deleteItem(actor: { id?: number; role?: string }, itemId: number) {
    const item = await this.receivingItemRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Stavka nije pronađena');
    const qty = Number(item.received_quantity || 0);
    // Admin može obrisati u svim statusima
    if (qty > 0 && actor?.role !== 'admin') {
      throw new BadRequestException('Nije moguće obrisati stavku koja je već primljena');
    }
    await this.receivingItemRepository.delete(itemId);
    return { ok: true };
  }

  // Assignees list for Dock Supervisor view
  async getAssignableWorkers() {
    const workers = await this.userRepository.find({ where: { role: 'magacioner', is_active: true } });
    if (workers.length === 0) return [];
    const ids = workers.map(w => w.id);
    const activeDocs = await this.receivingDocumentRepository
      .createQueryBuilder('d')
      .select('d.assigned_to', 'assigned_to')
      .addSelect('COUNT(*)', 'cnt')
      .where('d.status IN (:...st)', { st: [ReceivingStatus.IN_PROGRESS, ReceivingStatus.ON_HOLD] })
      .andWhere('d.assigned_to IN (:...ids)', { ids })
      .groupBy('d.assigned_to')
      .getRawMany();
    const countMap = new Map<number, number>();
    activeDocs.forEach(r => countMap.set(Number(r.assigned_to), Number(r.cnt)));
    return workers.map(w => ({
      id: w.id,
      name: w.name,
      username: w.username,
      role: w.role,
      shift: 'I smena',
      active_receivings: countMap.get(w.id) || 0,
    }));
  }

  // Reassign only (no status change). Allowed roles: admin, menadzer, sef
  async reassignDocument(id: number, assignedToUserId: number, actorRole: string, actorId?: number) {
    const allowed = ['admin', 'menadzer', 'sef', 'sef_magacina'];
    if (!allowed.includes(actorRole)) {
      throw new Error('Nedozvoljeno: samo admin/menadzer/sef mogu dodeliti prijem');
    }
    const document = await this.receivingDocumentRepository.findOne({ where: { id } });
    if (!document) throw new Error('Document not found');
    if (document.status === ReceivingStatus.COMPLETED) {
      throw new BadRequestException('Prijem je završen i ne može se preusmeriti.');
    }
    const oldAssigned = document.assigned_to;
    document.assigned_to = assignedToUserId;
    const saved = await this.receivingDocumentRepository.save(document);
    await this.syncReceivingAssignees(saved.id, assignedToUserId);
    await this.setReceivingAssigneeStatus(saved.id, 'ASSIGNED');
    // Log ASSIGN action
    await this.logAudit(id, 'ASSIGN', {
      actor: actorId ? { id: actorId, role: actorRole } : { id: 0, role: actorRole },
      document_number: saved.document_number,
      old_assigned_to: oldAssigned,
      new_assigned_to: assignedToUserId,
    });
    console.log(`[REASSIGN] doc=${id} from=${oldAssigned} to=${assignedToUserId} at=${new Date().toISOString()}`);
    const u = await this.userRepository.findOne({ where: { id: assignedToUserId } });
    return {
      id: saved.id,
      document_number: saved.document_number,
      status: saved.status,
      assigned_user: u ? { id: u.id, full_name: u.name, role: u.role } : null,
      message: u ? `Prijem je sada dodeljen ${u.name}` : 'Prijem je preusmeren',
    };
  }

  async importFromPantheon(file: any, notes?: string, assignedToOverride?: number, createdBy?: number | null) {
    const xlsx = require('xlsx');
    const fs = require('fs');
    
    if (!file) {
      throw new Error('Excel fajl nije priložen');
    }

    // Parse Excel file (buffer or path fallback)
    const buf: Buffer = file?.buffer || (file?.path ? fs.readFileSync(file.path) : null);
    if (!buf) throw new Error('Prazan fajl ili nije učitan');
    const workbook = xlsx.read(buf, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract document info from Excel
    let documentNumber = '';
    let documentDate = '';
    let supplierName = '';
    let storeName = '';
    let responsiblePerson = '';
    let invoiceNumber = '';
    let supplierId = 0;
    
    // Look for supplier name in header or first rows
    for (const row of data) {
      const entries = Array.isArray((row).entries) ? (row).entries() : Object.entries(row);
      for (const [keyRaw, valueRaw] of entries) {
        const key = this.decodeCellValue(keyRaw || '');
        const value = this.decodeCellValue(valueRaw || '');
        const keyLower = key.toLowerCase();
        if (keyLower.includes('dobavlja')) supplierName = value;
        if (keyLower.includes('prijem') || keyLower.includes('broj dokumenta')) documentNumber = value;
        if (keyLower.includes('datum')) documentDate = value;
        if (keyLower.includes('trgovina') || keyLower.includes('prodavn')) storeName = value;
        if (keyLower.includes('odgovorna')) responsiblePerson = value;
        if (keyLower.includes('račun') || keyLower.includes('racun') || keyLower.includes('invoice')) invoiceNumber = value;
      }
    }
    if (!supplierId) {
      const fallback = await this.supplierRepository.findOne({ where: { name: 'Unknown' } })
        || await this.supplierRepository.save(this.supplierRepository.create({ name: 'Unknown', country: '-', address: '' }));
      supplierId = fallback.id;
    }

    // Find or create supplier
    if (supplierName) {
      const existingSupplier = await this.supplierRepository.findOne({ 
        where: { name: supplierName } 
      });
      
      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        // Create new supplier
        const newSupplier = this.supplierRepository.create({
          name: supplierName,
          country: 'Srbija',
          address: '',
        });
        const savedSupplier = await this.supplierRepository.save(newSupplier);
        supplierId = savedSupplier.id;
      }
    }

    const assignedTo = (assignedToOverride !== undefined && assignedToOverride !== null && !Number.isNaN(Number(assignedToOverride)))
      ? Number(assignedToOverride)
      : null;
    const creatorId = (createdBy !== undefined && createdBy !== null && !Number.isNaN(Number(createdBy)))
      ? Number(createdBy)
      : null;
    const documentNumberFinal = documentNumber || `GRN-${new Date().getTime()}`;
    
    const document = this.receivingDocumentRepository.create({
      document_number: documentNumberFinal,
      supplier_id: supplierId,
      pantheon_invoice_number: (invoiceNumber || file.originalname || '').toString(),
      assigned_to: assignedTo,
      received_by: null,
      created_by: creatorId,
      notes: notes || 'Importovano iz Excel fajla',
      status: ReceivingStatus.DRAFT,
      document_date: parseDocumentDate(documentDate),
      store_name: storeName?.toString?.().trim() || null,
      responsible_person: responsiblePerson?.toString?.().trim() || null,
      invoice_number: (invoiceNumber || '').toString().trim() || null,
    });

    const savedDocument = await this.receivingDocumentRepository.save(document);
    await this.syncReceivingAssignees(savedDocument.id, assignedTo ?? creatorId ?? null, creatorId ?? null);
    await this.setReceivingAssigneeStatus(savedDocument.id, 'ASSIGNED');

    // Import items from Excel data
    const importedItems = [];
    let itemsCreated = 0;
    let itemsAdded = 0;

    for (const row of data) {
      // Extract data from Excel row
      const ident = row['Ident'] || row['SKU'] || row['Code'] || '';
      const itemName = row['Naziv'] || row['Item Name'] || row['Name'] || '';
      const barcode = row['Barcode'] || row['Bar Code'] || '';
      const quantity = parseFloat(row['Količina'] || row['Quantity'] || row['Qty'] || '0');
      const unit = row['JM'] || row['UOM'] || row['Unit'] || 'KOM';

      if (ident && itemName && quantity > 0) {
        // Check if item exists in database
        let item = await this.itemRepository.findOne({ where: { sku: ident } });

        // If item doesn't exist, create it
        if (!item) {
          item = this.itemRepository.create({
            sku: ident,
            name: itemName,
            supplier_id: supplierId,
            barcode: barcode || '',
          });
          item = await this.itemRepository.save(item);
          itemsCreated++;
        }

        // Add item to receiving document
        const receivingItem = this.receivingItemRepository.create({
          receiving_document_id: savedDocument.id,
          item_id: item.id,
          expected_quantity: quantity,
          received_quantity: 0,
          quantity_uom: unit,
          status: ItemStatus.PENDING,
          barcode: barcode || '',
        });
        await this.receivingItemRepository.save(receivingItem);
        itemsAdded++;
      }
    }

    return {
      id: savedDocument.id,
      document_number: savedDocument.document_number,
      status: savedDocument.status,
      items_created: itemsCreated,
      items_added: itemsAdded,
      message: `Importovanje uspešno! Kreirano ${itemsCreated} novih artikala, dodato ${itemsAdded} u prijem.`
    };
  }

  // Preview for Pantheon KCM/Kalkulacija prijema: auto-detect headers and metadata
  async previewPantheon(file: any) {
    const xlsx = require('xlsx');
    const fs = require('fs');
    if (!file) throw new Error('Excel fajl nije priložen');
    let workbook;
    try {
      const buf: Buffer = file?.buffer || (file?.path ? fs.readFileSync(file.path) : null);
      if (!buf) throw new Error('Prazan fajl ili nije učitan');
      workbook = xlsx.read(buf, { type: 'buffer' });
    } catch (e:any) {
      console.error('Receiving preview XLSX parse error:', e?.message || e);
      throw new Error('Greška pri čitanju Excel fajla: ' + (e?.message || 'nepoznata greška'));
    }
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    // Meta scan
    const norm = (v: any)=> (v??'').toString().trim().toLowerCase();
    let documentNumber = '';
    let supplierName = '';
    let documentDate = '';
    let storeName = '';
    let responsible = '';
    let invoice = '';

    const findRight = (label: string) => {
      const needle = label.toLowerCase();
      for (let r=0;r<Math.min(60, data.length);r++){
        const row = data[r]; if(!Array.isArray(row)) continue;
        for(let c=0;c<row.length;c++){
          const cell = row[c];
          const cellText = this.decodeCellValue(cell);
          const s = cellText.toLowerCase(); if(!s) continue;
          if(s.includes(needle)){
            const maxRight = Math.min(c+12, row.length-1);
            for(let k=c+1;k<=maxRight;k++){
              const v = row[k];
              const vText = this.decodeCellValue(v);
              if(vText) return vText;
            }
            for(let rr=r+1; rr<Math.min(r+8, data.length); rr++){
              const down = data[rr];
              if(Array.isArray(down)){
                const dv = down[c];
                const dvText = this.decodeCellValue(dv);
                if(dvText) return dvText;
              }
            }
          }
        }
      }
      return '';
    };
    documentNumber = findRight('prijemnica') || findRight('broj dokumenta');
    supplierName = findRight('dobavljač') || findRight('dobavljac') || findRight('supplier');
    storeName = findRight('trgovina') || findRight('prodavnica') || '';
    documentDate = findRight('datum') || '';
    responsible = findRight('odgovorna osoba') || '';
    invoice = findRight('račun') || findRight('racun') || findRight('raèun') || '';

    // Header detection for table
    let headerRow = -1, colSku=-1, colName=-1, colQty=-1, colUom=-1;
    const has = (x:any,s:string)=> ((x??'').toString().includes(s));
    for(let r=0;r<Math.min(50,data.length);r++){
      const row = data[r]; if(!Array.isArray(row)) continue;
      const low:any[] = row.map(norm);
      const idxSku = low.findIndex((x:any)=> has(x,'ident') || has(x,'šifra') || has(x,'sifra') || has(x,'sku') || has(x,'code'));
      const idxName = low.findIndex((x:any)=> has(x,'naziv') || has(x,'name'));
      const idxQty = low.findIndex((x:any)=> has(x,'količ') || has(x,'kolic') || x==='kol' || has(x,'qty') || has(x,'kolicina'));
      const idxUom = low.findIndex((x:any)=> x==='jm' || has(x,'jmj') || has(x,'uom') || has(x,'jed'));
      if(idxSku!==-1 && idxName!==-1 && idxQty!==-1){ headerRow=r; colSku=idxSku; colName=idxName; colQty=idxQty; colUom=idxUom; break; }
    }
    if(headerRow<0){ headerRow=10; colSku=2; colName=4; colQty=8; colUom=9; }

    const collect = (cs:number,cn:number,cq:number,cu:number)=>{
      const out:any[]=[]; for(let i=headerRow+1;i<data.length;i++){ const row=data[i]; if(!Array.isArray(row)) continue; const sku=(row[cs]??'').toString().trim(); const name=(row[cn]??'').toString().trim(); const qty=Number((row[cq]??'').toString().replace(',','.'))||0; const uom=cu!==-1?((row[cu]??'').toString().trim()||'KOM'):'KOM'; if(sku&&name&&qty>0) out.push({ item_sku: sku, item_name: name, requested_qty: qty, uom }); }
      return out;
    };
    let lines:any[] = collect(colSku,colName,colQty,colUom);
    if(lines.length===0){
      const candidates = [ [1,3,9,11], [3,5,10,12], [2,4,8,9], [3,5,9,12] ];
      for(const [cs,cn,cq,cu] of candidates){ lines = collect(cs,cn,cq,cu); if(lines.length){ colSku=cs; colName=cn; colQty=cq; colUom=cu; break; } }
    }

    return {
      preview: true,
      document_number: documentNumber || (file.originalname||'').replace(/\.[^.]+$/,''),
      supplier_name: supplierName||null,
      store_name: storeName||null,
      document_date: documentDate||null,
      responsible_person: responsible||null,
      invoice_number: invoice||null,
      detected_columns: { header_row: headerRow, sku: colSku, name: colName, qty: colQty, uom: colUom },
      items_found: lines.length,
      lines,
    };
  }

  async importFromJson(body: any, userId: number) {
    const { document_number, supplier_name, document_date, store_name, responsible_person, invoice_number, lines, notes } = body || {};
    if (!Array.isArray(lines) || lines.length===0) throw new Error('Nema stavki za import');
    const docNo = document_number || `GRN-${Date.now()}`;
    // supplier
    let supplierId = 0;
    if (supplier_name) {
      const ex = await this.supplierRepository.findOne({ where: { name: supplier_name } });
      if (ex) supplierId = ex.id; else { const s = await this.supplierRepository.save(this.supplierRepository.create({ name: supplier_name, country: '-', address: '' })); supplierId = s.id; }
    }
    const creatorId = userId || null;
    const doc = this.receivingDocumentRepository.create({
      document_number: docNo,
      supplier_id: supplierId || 0,
      pantheon_invoice_number: (invoice_number || '').toString().trim() || '',
      assigned_to: null,
      received_by: null,
      created_by: creatorId,
      notes: notes || '',
      status: ReceivingStatus.DRAFT,
      document_date: parseDocumentDate(document_date),
      store_name: store_name?.toString?.().trim() || null,
      responsible_person: responsible_person?.toString?.().trim() || null,
      invoice_number: invoice_number?.toString?.().trim() || null,
    });
    const saved = await this.receivingDocumentRepository.save(doc);
    await this.syncReceivingAssignees(saved.id, creatorId ?? null, creatorId ?? null);
    await this.setReceivingAssigneeStatus(saved.id, 'ASSIGNED');
    let itemsCreated=0; const ri: any[] = [];
    for(const ln of lines){
      const sku=(ln.item_sku||'').toString().trim(); const name=(ln.item_name||'').toString().trim(); const qty=Number(ln.requested_qty||0); const uom=(ln.uom||'KOM').toString();
      if(!sku||!name||qty<=0) continue;
      let item = await this.itemRepository.findOne({ where: { sku } });
      if(!item){ item = await this.itemRepository.save(this.itemRepository.create({ sku, name, supplier_id: supplierId||0, barcode: '' })); itemsCreated++; }
      ri.push(this.receivingItemRepository.create({ receiving_document_id: saved.id, item_id: item.id, expected_quantity: qty, received_quantity: 0, quantity_uom: uom, status: ItemStatus.PENDING, barcode: '' }));
    }
    if (ri.length) await this.receivingItemRepository.save(ri);
    return {
      id: saved.id,
      document_number: saved.document_number,
      status: saved.status,
      items_created: itemsCreated,
      items_added: ri.length,
      document_date: saved.document_date,
      store_name: saved.store_name,
      responsible_person: saved.responsible_person,
      invoice_number: saved.invoice_number,
      message: `Uspješan import prijema: ${ri.length} stavki`
    };
  }

  private decodeCellValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value).trim();
    }
    return '';
  }
}
