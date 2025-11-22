import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CycleCountTask, CycleCountTaskStatus } from './cycle-count-task.entity';
import { CycleCountLine, CycleCountLineStatus } from './cycle-count-line.entity';
import { Location } from '../entities/location.entity';
import { Zone } from '../entities/zone.entity';
import { Rack } from '../entities/rack.entity';
import { Aisle } from '../entities/aisle.entity';
import { Inventory } from '../entities/inventory.entity';
import { Item } from '../entities/item.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';

@Injectable()
export class CycleCountService {
  constructor(
    @InjectRepository(CycleCountTask) private taskRepo: Repository<CycleCountTask>,
    @InjectRepository(CycleCountLine) private lineRepo: Repository<CycleCountLine>,
    @InjectRepository(Location) private locRepo: Repository<Location>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(InventoryMovement) private moveRepo: Repository<InventoryMovement>,
    @InjectRepository(Zone) private zoneRepo: Repository<Zone>,
    @InjectRepository(Rack) private rackRepo: Repository<Rack>,
    @InjectRepository(Aisle) private aisleRepo: Repository<Aisle>,
  ) {}

  private ensureRole(role: string, allowed: string[]) {
    if (!allowed.includes(role)) throw new ForbiddenException('Zabranjen pristup');
  }

  async createTask(actor: { id: number; role: string }, body: { scope: 'LOKACIJA'|'ZONA'; target_code: string; assign_to_user_id?: number }) {
    this.ensureRole(actor.role, ['admin','sef_magacina']);
    if (!body?.scope || !body?.target_code) throw new BadRequestException('scope i target_code su obavezni');
    const task = this.taskRepo.create({
      scope: body.scope,
      target_code: body.target_code,
      status: CycleCountTaskStatus.OPEN,
      assigned_to_user_id: body.assign_to_user_id || null,
      created_by_user_id: actor.id,
    });
    const saved = await this.taskRepo.save(task);
    // generate lines from current inventory snapshot
    let locationIds: number[] = [];
    if (body.scope === 'LOKACIJA') {
      const loc = await this.locRepo.findOne({ where: { code: body.target_code } });
      if (!loc) throw new BadRequestException('Lokacija ne postoji');
      locationIds = [loc.id];
    } else {
      // ZONA — find zone by name and collect all locations under it
      const zone = await this.zoneRepo.findOne({ where: { name: body.target_code } });
      if (!zone) throw new BadRequestException('Zona ne postoji');
      // aisles -> racks -> locations
      const aisles = await this.aisleRepo.find({ where: { zone_id: zone.id } });
      const aisleIds = aisles.map(a => a.id);
      if (aisleIds.length) {
        const racks = await this.rackRepo
          .createQueryBuilder('r')
          .where('r.aisle_id IN (:...ids)', { ids: aisleIds })
          .getMany();
        const rackIds = racks.map(r => r.id);
        if (rackIds.length) {
          const locs = await this.locRepo
            .createQueryBuilder('l')
            .where('l.rack_id IN (:...rids)', { rids: rackIds })
            .getMany();
          locationIds = locs.map(l => l.id);
        }
      }
    }
    const invRows = locationIds.length ? await this.invRepo
      .createQueryBuilder('inv')
      .where('inv.location_id IN (:...locs)', { locs: locationIds })
      .getMany() : [];
    const lines: CycleCountLine[] = [];
    for (const r of invRows) {
      const line = this.lineRepo.create({
        task_id: saved.id,
        location_id: r.location_id,
        item_id: r.item_id,
        system_qty: String(r.quantity || '0'),
        counted_qty: null,
        difference: null,
        status: CycleCountLineStatus.PENDING,
        approved_by_user_id: null,
      });
      lines.push(line);
    }
    if (lines.length) await this.lineRepo.save(lines);
    return { id: saved.id };
  }

  async listTasks(actor: { role: string }, params?: { status?: string; assigned_to_user_id?: number }) {
    this.ensureRole(actor.role, ['admin','sef_magacina']);
    const qb = this.taskRepo.createQueryBuilder('t').orderBy('t.created_at', 'DESC');
    if (params?.status) qb.andWhere('t.status = :st', { st: params.status });
    if (params?.assigned_to_user_id) qb.andWhere('t.assigned_to_user_id = :au', { au: params.assigned_to_user_id });
    const rows = await qb.getMany();
    // compute simple differences summary
    for (const t of rows) {
      const cnt = await this.lineRepo.count({ where: { task_id: t.id, status: CycleCountLineStatus.COUNTED } });
      (t as any).counted_lines = cnt;
    }
    return rows;
  }

  async myTasks(userId: number) {
    return this.taskRepo.createQueryBuilder('t')
      .where('t.assigned_to_user_id = :u', { u: userId })
      .andWhere('t.status != :rec', { rec: CycleCountTaskStatus.RECONCILED })
      .orderBy('t.created_at', 'DESC')
      .getMany();
  }

  async getTask(id: number) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new BadRequestException('Task ne postoji');
    const lines = await this.lineRepo.find({ where: { task_id: id } });
    return { ...task, lines };
  }

  async startTask(actor: { id: number; role: string }, id: number) {
    // magacioner may start
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new BadRequestException('Task ne postoji');
    if (task.status !== CycleCountTaskStatus.OPEN) return { ok: true };
    task.status = CycleCountTaskStatus.IN_PROGRESS;
    await this.taskRepo.save(task);
    return { ok: true };
  }

  async completeTask(actor: { id: number; role: string }, id: number) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new BadRequestException('Task ne postoji');
    task.status = CycleCountTaskStatus.COMPLETED;
    await this.taskRepo.save(task);
    return { ok: true };
  }

  async updateLine(actor: { id: number; role: string }, lineId: number, counted_qty: number) {
    if (actor.role !== 'magacioner') throw new ForbiddenException('Zabranjeno');
    const line = await this.lineRepo.findOne({ where: { id: lineId } });
    if (!line) throw new BadRequestException('Stavka ne postoji');
    const sys = parseFloat(String(line.system_qty || '0'));
    const diff = counted_qty - sys;
    line.counted_qty = String(counted_qty);
    line.difference = String(diff);
    line.status = CycleCountLineStatus.COUNTED;
    await this.lineRepo.save(line);
    return { ok: true };
  }

  async reconcile(actor: { id: number; role: string }, id: number) {
    this.ensureRole(actor.role, ['admin','sef_magacina']);
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new BadRequestException('Task ne postoji');
    // process lines
    const lines = await this.lineRepo.find({ where: { task_id: id } });
    for (const line of lines) {
      if (line.status !== CycleCountLineStatus.COUNTED) continue;
      const counted = parseFloat(String(line.counted_qty || '0'));
      // write movement
      const mv = this.moveRepo.create({
        item_id: line.item_id,
        from_location_id: null,
        to_location_id: line.location_id,
        quantity_change: counted,
        reason: 'POPIS',
        reference_document_id: id,
        created_by: actor.id,
      } as any);
      await this.moveRepo.save(mv);
      // upsert inventory
      let inv = await this.invRepo.findOne({ where: { item_id: line.item_id, location_id: line.location_id } });
      if (!inv) inv = this.invRepo.create({ item_id: line.item_id, location_id: line.location_id, quantity: String(counted) });
      inv.quantity = String(counted);
      await this.invRepo.save(inv);
      // approve line
      line.status = CycleCountLineStatus.APPROVED;
      line.approved_by_user_id = actor.id;
      await this.lineRepo.save(line);
    }
    task.status = CycleCountTaskStatus.RECONCILED;
    await this.taskRepo.save(task);
    return { ok: true };
  }

  async deleteTask(actor: { id: number; role: string }, id: number) {
    // Allow delete only for admin/menadzer/sef and only when task is OPEN (nije započet)
    const allowed = ['admin','menadzer','sef'];
    if (!allowed.includes(actor.role)) {
      throw new Error('Nemate dozvolu za brisanje popisa');
    }
    const t = await this.taskRepo.findOne({ where: { id } });
    if (!t) throw new Error('Popis nije pronađen');
    if (t.status !== CycleCountTaskStatus.OPEN) {
      throw new Error('Brisanje dozvoljeno samo za neaktivne (OPEN) popis zadatke');
    }
    await this.lineRepo.delete({ task_id: id } as any);
    await this.taskRepo.delete(id);
    return { ok: true };
  }
}
