import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SkartDocument, SkartStatus } from './entities/skart-document.entity';
import { SkartItem } from './entities/skart-item.entity';
import { SkartPhoto } from './entities/skart-photo.entity';
import { Store } from '../entities/store.entity';
import { Item } from '../entities/item.entity';
import { Inventory } from '../entities/inventory.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { AssignmentsGateway } from '../workforce/assignments.gateway';
import { CreateSkartDto } from './dto/create-skart.dto';
import { ReceiveSkartDto } from './dto/receive-skart.dto';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { buildSkartQrPdf } from '../common/pdf/qr.util';

type Actor = { id: number; role: string; name?: string; storeId?: number | null };

@Injectable()
export class SkartService {
  private readonly uploadsRoot = join(process.cwd(), 'uploads', 'skart');
  private readonly decrementInventory = (process.env.SKART_DECREMENTS_INVENTORY || '').toLowerCase() === 'true';

  constructor(
    @InjectRepository(SkartDocument) private readonly documentRepo: Repository<SkartDocument>,
    @InjectRepository(SkartItem) private readonly itemRepo: Repository<SkartItem>,
    @InjectRepository(SkartPhoto) private readonly photoRepo: Repository<SkartPhoto>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(Item) private readonly itemCatalogRepo: Repository<Item>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Inventory) private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    @Optional() @Inject(forwardRef(() => AssignmentsGateway))
    private readonly assignmentsWs?: AssignmentsGateway,
  ) {}

  async listDocuments(params: { limit?: number; offset?: number; status?: SkartStatus | 'ALL'; assignedToUserId?: number } = {}, actor?: Actor) {
    const qb = this.documentRepo
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.store', 'store')
      .leftJoinAndSelect('doc.items', 'items')
      .leftJoinAndSelect('doc.photos', 'photos')
      .orderBy('doc.created_at', 'DESC');

    if (params.status && params.status !== 'ALL') {
      qb.andWhere('doc.status = :status', { status: params.status });
    }

    if (actor && this.isStoreScoped(actor.role)) {
      const storeId = actor.storeId ?? null;
      if (!storeId) {
        throw new ForbiddenException('Nalog nema dodeljenu prodavnicu.');
      }
      qb.andWhere('doc.store_id = :storeId', { storeId });
    }

    if (params.assignedToUserId !== undefined && params.assignedToUserId !== null) {
      const assignedId = Number(params.assignedToUserId);
      if (!Number.isFinite(assignedId)) {
        throw new BadRequestException('Neispravan assignedToUserId parametar.');
      }
      if (actor && actor.id !== assignedId) {
        const normalized = (actor.role || '').toLowerCase();
        const canViewOthers = ['admin', 'menadzer', 'sef', 'sef_magacina', 'warehouse'].includes(normalized);
        if (!canViewOthers) {
          throw new ForbiddenException('Nemate dozvolu da pregledate dodeljene dokumente drugih korisnika.');
        }
      }
      qb.andWhere('doc.assigned_to_user_id = :assignedToUserId', { assignedToUserId: assignedId });
    }

    if (params.limit) qb.take(params.limit);
    if (params.offset) qb.skip(params.offset);

    const [rows, count] = await qb.getManyAndCount();
    return {
      total: count,
      data: rows.map((row) => this.buildDocumentResponse(row)),
    };
  }

  async createDocument(actor: Actor, dto: CreateSkartDto) {
    this.ensureRole(actor.role, ['admin', 'store', 'prodavnica', 'menadzer', 'sef', 'sef_prodavnice']);
    if (!dto.items || !dto.items.length) {
      throw new BadRequestException('Dodajte najmanje jednu stavku skarta.');
    }

    const actorStoreId = this.isStoreScoped(actor.role) ? (actor.storeId ?? null) : null;
    if (this.isStoreScoped(actor.role) && !actorStoreId) {
      throw new ForbiddenException('Nalog nema dodeljenu prodavnicu.');
    }

    const requestedStoreId = dto.storeId !== undefined && dto.storeId !== null ? Number(dto.storeId) : null;
    if (requestedStoreId !== null && Number.isNaN(requestedStoreId)) {
      throw new BadRequestException('Neispravan ID prodavnice.');
    }
    if (actorStoreId && requestedStoreId && requestedStoreId !== actorStoreId) {
      throw new ForbiddenException('Niste ovlašćeni da kreirate SKART za drugu prodavnicu.');
    }

    const storeId = actorStoreId ?? requestedStoreId;
    if (!storeId) {
      throw new BadRequestException('Odaberite prodavnicu.');
    }

    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Prodavnica nije pronađena.');
    }

    // Validacija: svaki artikal mora imati bar jednu fotografiju oštećenja
    dto.items.forEach((item, index) => {
      if (!item.reason || !item.reason.trim()) {
        throw new BadRequestException(`Unesite razlog oštećenja za stavku #${index + 1}.`);
      }
      if (Number(item.qty) <= 0) {
        throw new BadRequestException(`Količina mora biti veća od 0 za stavku #${index + 1}.`);
      }
      if (!item.photos || !Array.isArray(item.photos) || item.photos.length === 0) {
        throw new BadRequestException(`Fotografija oštećenja je obavezna za artikal "${item.name || item.code}" (stavka #${index + 1}). Dodajte bar jednu fotografiju.`);
      }
    });

    const uid = this.generateUid();
    const now = new Date();

    const document = this.documentRepo.create({
      uid,
      store_id: store.id,
      status: SkartStatus.SUBMITTED,
      created_by: actor.id,
      note: dto.note || null,
      created_at: now,
      updated_at: now,
    });

    const saved = await this.documentRepo.save(document);

    if (this.assignmentsWs) {
      this.assignmentsWs.broadcastTaskCreated({
        type: 'SKART',
        task_id: saved.id,
        uid: saved.uid,
        store_name: store.name,
        created_by_id: actor.id,
        created_by_name: actor.name,
        created_at: saved.created_at,
      });
    }

    const catalogItems = await this.lookupItemsByCode(dto.items.map((i) => i.code));
    const itemsToCreate = dto.items.map((item) => {
      const catalog = catalogItems.get(item.code);
      return this.itemRepo.create({
        document_id: saved.id,
        code: item.code,
        name: item.name,
        qty: this.toNumericString(item.qty),
        reason: item.reason,
        note: item.note ?? null,
        item_id: catalog?.id ?? null,
      });
    });

    const savedItems = await this.itemRepo.save(itemsToCreate);

    // Čuvaj slike po artiklu (ako postoje u item.photos)
    for (let i = 0; i < dto.items.length; i++) {
      const itemDto = dto.items[i];
      const savedItem = savedItems[i];
      if (itemDto.photos?.length && savedItem) {
        await this.persistBase64Photos(saved.id, uid, itemDto.photos, actor.id, savedItem.id);
      }
    }

    // Legacy support: ako postoje slike na nivou dokumenta, dodeli ih prvom artiklu
    if (dto.photos?.length && !dto.items.some(item => item.photos?.length)) {
      const firstItem = savedItems[0];
      if (firstItem) {
        await this.persistBase64Photos(saved.id, uid, dto.photos, actor.id, firstItem.id);
      }
    }

    await this.logAudit(saved.id, 'CREATE', {
      actor: { id: actor.id, role: actor.role },
      payload: dto,
    });

    const fresh = await this.getDocumentByUid(uid, actor);
    return fresh;
  }

  async getDocumentByUid(uid: string, actor?: Actor) {
    const row = await this.documentRepo.findOne({
      where: { uid },
      relations: ['items', 'photos', 'store'],
    });
    if (!row) throw new NotFoundException('SKART dokument nije pronađen.');
    if (actor && this.isStoreScoped(actor.role)) {
      const storeId = actor.storeId ?? null;
      if (!storeId || storeId !== row.store_id) {
        throw new ForbiddenException('Nemate pristup ovom dokumentu.');
      }
    }
    return this.buildDocumentResponse(row);
  }

  async receiveDocument(actor: Actor, uid: string, dto: ReceiveSkartDto) {
    this.ensureRole(actor.role, ['admin', 'magacioner', 'warehouse', 'sef', 'menadzer']);
    const document = await this.documentRepo.findOne({
      where: { uid },
      relations: ['items', 'store'],
    });
    if (!document) throw new NotFoundException('SKART dokument nije pronađen.');
    if (document.status === SkartStatus.RECEIVED) {
      throw new BadRequestException('Dokument je već primljen.');
    }

    const updates = new Map<string, number>();
    for (const line of dto.items || []) {
      const qty = Number(line.receivedQty);
      if (Number.isNaN(qty) || qty < 0) {
        throw new BadRequestException(`Neispravna količina za artikal ${line.code}.`);
      }
      updates.set(line.code, qty);
    }

    const catalogItems = await this.lookupItemsByCode(document.items.map((i) => i.code));
    const movements: { itemId: number; qty: number }[] = [];

    for (const item of document.items) {
      const receivedQty = updates.has(item.code) ? updates.get(item.code) : Number(item.received_qty || 0);
      item.received_qty = this.toNumericString(receivedQty);
      const catalog = catalogItems.get(item.code);
      if (!item.item_id && catalog) {
        item.item_id = catalog.id;
      }
      if (catalog && receivedQty > 0) {
        movements.push({ itemId: catalog.id, qty: receivedQty });
      }
    }

    document.status = SkartStatus.RECEIVED;
    document.received_by = actor.id;
    document.received_at = new Date();
    document.note = dto.note ?? document.note ?? null;

    await this.documentRepo.save(document);
    await this.itemRepo.save(document.items);

    if (movements.length) {
      await this.recordInventoryMovements(document.id, actor.id, movements);
    }

    await this.logAudit(document.id, 'RECEIVE', {
      actor: { id: actor.id, role: actor.role },
      items: dto.items,
      note: dto.note ?? null,
    });

    // Get worker info for notification
    let workerId: number | undefined;
    let workerName: string | undefined;
    
    if (document.assigned_to_user_id) {
      workerId = document.assigned_to_user_id;
      const user = await this.userRepo.findOne({ where: { id: workerId } });
      workerName = (user as any)?.full_name || user?.name || user?.username;
    } else if (actor.id) {
      workerId = actor.id;
      workerName = actor.name || 'Nepoznat';
    }

    // Broadcast task completion notification
    if (this.assignmentsWs) {
      try {
        this.assignmentsWs.broadcastTaskCompleted({
          type: 'SKART',
          task_id: document.id,
          uid: document.uid,
          worker_id: workerId,
          worker_name: workerName,
          completed_at: document.received_at,
        });
      } catch (e) {
        // Ignore WebSocket errors
      }
    }

    return this.getDocumentByUid(uid);
  }

  async addPhoto(actor: Actor, uid: string, filePath: string) {
    this.ensureRole(actor.role, ['admin', 'store', 'prodavnica', 'magacioner', 'warehouse', 'sef', 'menadzer']);
    const document = await this.documentRepo.findOne({ where: { uid } });
    if (!document) throw new NotFoundException('SKART dokument nije pronađen.');
    if (this.isStoreScoped(actor.role)) {
      const storeId = actor.storeId ?? null;
      if (!storeId || storeId !== document.store_id) {
        throw new ForbiddenException('Nemate pristup ovom dokumentu.');
      }
    }

    const entity = this.photoRepo.create({
      document_id: document.id,
      path: filePath,
      uploaded_by: actor.id,
    });
    await this.photoRepo.save(entity);

    await this.logAudit(document.id, 'PHOTO_ADDED', {
      actor: { id: actor.id, role: actor.role },
      path: filePath,
    });

    return this.getDocumentByUid(uid, actor);
  }

  async assignDocument(actor: Actor, uid: string, assignedToUserId: number | null) {
    this.ensureRole(actor.role, ['admin', 'menadzer', 'sef', 'sef_magacina']);
    
    const document = await this.documentRepo.findOne({
      where: { uid },
      relations: ['store'],
    });
    
    if (!document) {
      throw new NotFoundException('SKART dokument nije pronađen.');
    }
    
    if (document.status === SkartStatus.RECEIVED) {
      throw new BadRequestException('Ne možete dodeliti već primljen dokument.');
    }
    
    // Proveri da li assigned user postoji i da li je magacioner
    if (assignedToUserId !== null) {
      const assignedUser = await this.userRepo.findOne({
        where: { id: assignedToUserId },
      });
      
      if (!assignedUser) {
        throw new BadRequestException('Korisnik za dodelu nije pronađen.');
      }
      
      const allowedRoles = ['magacioner', 'warehouse', 'admin', 'menadzer', 'sef'];
      if (!allowedRoles.includes(assignedUser.role?.toLowerCase() || '')) {
        throw new BadRequestException('Korisnik mora biti magacioner da bi mogao da primi SKART nalog.');
      }
    }
    
    document.assigned_to_user_id = assignedToUserId;
    document.updated_at = new Date();
    await this.documentRepo.save(document);
    
    await this.logAudit(document.id, 'ASSIGN', {
      actor: { id: actor.id, role: actor.role },
      assignedToUserId,
    });
    
    return this.getDocumentByUid(uid, actor);
  }

  async summaryReport(params: { from?: string; to?: string; storeId?: number; window?: string } = {}, actor?: Actor) {
    const qb = this.documentRepo
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.store', 'store')
      .leftJoinAndSelect('doc.items', 'items')
      .orderBy('doc.created_at', 'DESC');

    const actorStoreId = actor && this.isStoreScoped(actor.role) ? (actor.storeId ?? null) : null;
    if (actorStoreId) {
      qb.andWhere('doc.store_id = :storeId', { storeId: actorStoreId });
    } else if (params.storeId) {
      qb.andWhere('doc.store_id = :storeId', { storeId: params.storeId });
    }

    const { from, to } = this.resolveWindow(params);
    if (from) qb.andWhere('doc.created_at >= :from', { from });
    if (to) qb.andWhere('doc.created_at <= :to', { to });

    const documents = await qb.getMany();

    let submittedCount = 0;
    let receivedCount = 0;
    const byStore = new Map<number, { storeId: number; storeName: string; submitted: number; received: number }>();
    const byReason = new Map<string, number>();
    const byItem = new Map<string, { code: string; name: string; qty: number }>();
    const timeline = new Map<string, { date: string; submitted: number; received: number }>();

    for (const doc of documents) {
      submittedCount += 1;
      if (doc.status === SkartStatus.RECEIVED) receivedCount += 1;

      const storeKey = doc.store_id;
      if (!byStore.has(storeKey)) {
        byStore.set(storeKey, {
          storeId: storeKey,
          storeName: doc.store?.name || `Prodavnica #${storeKey}`,
          submitted: 0,
          received: 0,
        });
      }
      const storeStat = byStore.get(storeKey);
      storeStat.submitted += 1;
      if (doc.status === SkartStatus.RECEIVED) storeStat.received += 1;

      const dateKey = doc.created_at.toISOString().substring(0, 10);
      if (!timeline.has(dateKey)) {
        timeline.set(dateKey, { date: dateKey, submitted: 0, received: 0 });
      }
      const dayStat = timeline.get(dateKey);
      dayStat.submitted += 1;
      if (doc.status === SkartStatus.RECEIVED) dayStat.received += 1;

      for (const item of doc.items || []) {
        const qty = Number(item.qty || 0) || 0;
        const reasonKey = item.reason || 'Nepoznato';
        byReason.set(reasonKey, (byReason.get(reasonKey) || 0) + qty);

        const itemKey = item.code;
        if (!byItem.has(itemKey)) {
          byItem.set(itemKey, { code: item.code, name: item.name, qty: 0 });
        }
        byItem.get(itemKey).qty += qty;
      }
    }

    const totalQty = Array.from(byReason.values()).reduce((acc, val) => acc + val, 0) || 1;
    const anomalies: Array<{ storeId: number; storeName: string; share: number }> = [];
    byStore.forEach((stat) => {
      const reasonVolume = documents
        .filter((doc) => doc.store_id === stat.storeId)
        .flatMap((doc) => doc.items || [])
        .reduce((acc, item) => acc + (Number(item.qty || 0) || 0), 0);
      const share = reasonVolume / totalQty;
      if (share > 0.3) {
        anomalies.push({ storeId: stat.storeId, storeName: stat.storeName, share: Number(share.toFixed(3)) });
      }
    });

    const topItems = Array.from(byItem.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((item) => ({ ...item, qty: Number(item.qty.toFixed(3)) }));

    return {
      totalSubmitted: submittedCount,
      totalReceived: receivedCount,
      byStore: Array.from(byStore.values()),
      byReason: Array.from(byReason.entries()).map(([reason, qty]) => ({ reason, qty: Number(qty.toFixed(3)) })),
      topItems,
      timeline: Array.from(timeline.values()).sort((a, b) => (a.date < b.date ? -1 : 1)),
      anomalies,
    };
  }

  async anomaliesReport(params: { from?: string; to?: string; window?: string } = {}, actor?: Actor) {
    const summary = await this.summaryReport(params, actor);
    return summary.anomalies;
  }

  async generateQrPdf(uid: string, actor?: Actor) {
    const doc = await this.documentRepo.findOne({
      where: { uid },
      relations: ['items', 'store'],
    });
    if (!doc) throw new NotFoundException('SKART dokument nije pronađen.');
    if (actor && this.isStoreScoped(actor.role)) {
      const storeId = actor.storeId ?? null;
      if (!storeId || storeId !== doc.store_id) {
        throw new ForbiddenException('Nemate pristup ovom dokumentu.');
      }
    }

    const payload = this.buildDocumentResponse(doc);
    return buildSkartQrPdf(payload);
  }

  private async recordInventoryMovements(documentId: number, actorId: number, movements: Array<{ itemId: number; qty: number }>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const mv of movements) {
        await queryRunner.manager.query(
          `INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [mv.itemId, null, null, -Math.abs(mv.qty), 'SKART', documentId, actorId],
        );

        if (this.decrementInventory) {
          let remaining = Math.abs(mv.qty);
          const inventoryRepo = queryRunner.manager.getRepository(Inventory);
          const inventoryRows = await inventoryRepo.find({
            where: { item_id: mv.itemId },
            order: { quantity: 'DESC' },
          });
          for (const row of inventoryRows) {
            if (remaining <= 0) break;
            const current = Number(row.quantity as any) || 0;
            if (current <= 0) continue;
            const delta = Math.min(current, remaining);
            row.quantity = this.toNumericString(current - delta);
            await inventoryRepo.save(row);
            remaining -= delta;
          }
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async persistBase64Photos(documentId: number, uid: string, photos: string[], actorId: number, itemId?: number | null) {
    if (!photos.length) return;
    const targetDir = join(this.uploadsRoot, uid);
    await fs.mkdir(targetDir, { recursive: true });
    const records: SkartPhoto[] = [];
    for (const raw of photos) {
      try {
        const { buffer, ext } = this.decodeBase64Photo(raw);
        const fileName = `${Date.now()}-${randomBytes(5).toString('hex')}.${ext}`;
        const absPath = join(targetDir, fileName);
        await fs.writeFile(absPath, buffer);
        const webPath = `/uploads/skart/${uid}/${fileName}`;
        records.push(
          this.photoRepo.create({
            document_id: documentId,
            item_id: itemId ?? null,
            path: webPath,
            uploaded_by: actorId,
          }),
        );
      } catch {
        // Ignore malformed photos
      }
    }
    if (records.length) {
      await this.photoRepo.save(records);
    }
  }

  private decodeBase64Photo(raw: string): { buffer: Buffer; ext: string } {
    if (!raw) throw new Error('empty photo');
    const matches = raw.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    let mime = 'image/jpeg';
    let data = raw;
    if (matches) {
      mime = matches[1];
      data = matches[2];
    }
    const buffer = Buffer.from(data, 'base64');
    const ext = mime.split('/')[1]?.split('+')[0] || 'jpg';
    return { buffer, ext };
  }

  private async lookupItemsByCode(codes: string[]) {
    const unique = Array.from(new Set(codes.filter(Boolean)));
    if (!unique.length) return new Map<string, Item>();
    const found = await this.itemCatalogRepo
      .createQueryBuilder('item')
      .where('item.sku IN (:...codes)', { codes: unique })
      .getMany();
    const map = new Map<string, Item>();
    for (const item of found) {
      map.set(item.sku, item);
    }
    return map;
  }

  private buildDocumentResponse(document: SkartDocument) {
    return {
      id: document.id,
      uid: document.uid,
      status: document.status,
      storeId: document.store_id,
      storeName: document.store?.name || null,
      note: document.note || null,
      createdBy: document.created_by,
      assignedToUserId: document.assigned_to_user_id,
      receivedBy: document.received_by,
      createdAt: document.created_at,
      receivedAt: document.received_at,
      items: (document.items || []).map((item) => {
        // Grupiši slike po artiklu
        const itemPhotos = (document.photos || []).filter(p => p.item_id === item.id);
        return {
          id: item.id,
          code: item.code,
          name: item.name,
          qty: Number(item.qty || 0),
          reason: item.reason,
          receivedQty: item.received_qty ? Number(item.received_qty) : null,
          note: item.note || null,
          itemId: item.item_id,
          photos: itemPhotos.map((photo) => ({
            id: photo.id,
            path: photo.path,
            uploadedBy: photo.uploaded_by,
            uploadedAt: photo.uploaded_at,
          })),
        };
      }),
      // Legacy: sve slike (bez item_id ili koje nisu dodeljene artiklu)
      photos: (document.photos || []).filter(p => !p.item_id).map((photo) => ({
        id: photo.id,
        path: photo.path,
        uploadedBy: photo.uploaded_by,
        uploadedAt: photo.uploaded_at,
      })),
    };
  }

  private resolveWindow(params: { from?: string; to?: string; window?: string }) {
    if (params.window === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    return { from, to };
  }

  private toNumericString(value: number) {
    const normalized = Number(value) || 0;
    return normalized.toFixed(3);
  }

  private generateUid() {
    return `SK-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private isStoreScoped(role: string) {
    const normalized = (role || '').toLowerCase();
    return ['store', 'prodavnica', 'sef_prodavnice'].includes(normalized);
  }

  private ensureRole(role: string, allowed: string[]) {
    const normalized = (role || '').toLowerCase();
    const ok = allowed.some((r) => r.toLowerCase() === normalized);
    if (!ok) {
      throw new ForbiddenException('Nemate dozvolu za ovu akciju.');
    }
  }

  async deleteDocument(actor: Actor, uid: string) {
    this.ensureRole(actor.role, ['admin', 'menadzer', 'sef', 'sef_magacina']);
    const document = await this.documentRepo.findOne({
      where: { uid },
      relations: ['items', 'photos'],
    });
    if (!document) {
      throw new NotFoundException('SKART dokument nije pronađen.');
    }

    // Obriši fotografije sa diska
    const photoDir = join(this.uploadsRoot, uid);
    try {
      await fs.rm(photoDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Photo directory deletion failed', error instanceof Error ? error.message : error);
    }

    // Obriši dokument (items i photos će se obrisati automatski zbog CASCADE)
    await this.documentRepo.remove(document);

    // Loguj audit
    await this.logAudit(document.id, 'DELETE', {
      actor: { id: actor.id, role: actor.role },
      uid: document.uid,
    });
  }

  private async logAudit(documentId: number, action: string, payload: Record<string, any>) {
    try {
      await this.auditRepo.insert({
        entity: 'SKART_DOCUMENT',
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
}


