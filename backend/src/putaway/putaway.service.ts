import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PutawayTask } from '../entities/putaway-task.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { User } from '../entities/user.entity';
import { Item } from '../entities/item.entity';
import { Location } from '../entities/location.entity';

@Injectable()
export class PutawayService {
  constructor(
    @InjectRepository(PutawayTask) private tasks: Repository<PutawayTask>,
    @InjectRepository(Inventory) private inv: Repository<Inventory>,
    @InjectRepository(InventoryMovement) private moves: Repository<InventoryMovement>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Item) private items: Repository<Item>,
    @InjectRepository(Location) private locations: Repository<Location>,
  ) {}

  async createTask(dto: any, requester: User) {
    const item = await this.items.findOne({ where: { id: dto.item_id } });
    if (!item) throw new NotFoundException('Item not found');
    const assigned = dto.assigned_user_id ? await this.users.findOne({ where: { id: dto.assigned_user_id } }) : null;
    const task = this.tasks.create({
      pallet_id: dto.pallet_id,
      item,
      quantity: String(dto.quantity),
      uom: dto.uom,
      from_location_code: dto.from_location_code,
      to_location_code: dto.to_location_code,
      status: 'ASSIGNED',
      assigned_user: assigned || null,
      created_by: requester,
      notes: dto.notes || null,
    });
    return await this.tasks.save(task);
  }

  async listActive() {
    const list = await this.tasks.find({ where: [{ status: 'ASSIGNED' }, { status: 'IN_PROGRESS' }] as any, order: { created_at: 'ASC' } });
    return list.map(t => ({
      id: t.id,
      pallet_id: t.pallet_id,
      item_sku: t.item?.sku,
      item_name: t.item?.name,
      quantity: Number(t.quantity),
      uom: t.uom,
      from: t.from_location_code,
      to: t.to_location_code,
      assigned_user: t.assigned_user ? ((t.assigned_user as any).full_name || t.assigned_user.name) : null,
      assigned_user_id: t.assigned_user?.id,
      status: t.status,
      age_minutes: Math.floor((Date.now() - new Date(t.created_at).getTime()) / 60000),
    }));
  }

  async reassign(id: number, assigned_user_id: number) {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    const user = await this.users.findOne({ where: { id: assigned_user_id } });
    if (!user) throw new NotFoundException('User not found');
    task.assigned_user = user;
    await this.tasks.save(task);
    return { ok: true };
  }

  async myTasks(userId: number) {
    const list = await this.tasks.find({ where: [{ status: 'ASSIGNED' }, { status: 'IN_PROGRESS' }] as any });
    return list.filter(t => t.assigned_user?.id === userId).map(t => ({
      id: t.id,
      pallet_id: t.pallet_id,
      item_sku: t.item?.sku,
      item_name: t.item?.name,
      quantity: Number(t.quantity),
      uom: t.uom,
      from: t.from_location_code,
      to: t.to_location_code,
      status: t.status,
    }));
  }

  async startTask(id: number, userId: number) {
    const task = await this.tasks.findOne({ where: { id }, relations: ['assigned_user'] });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.assigned_user || task.assigned_user.id !== userId) throw new ForbiddenException('Not your task');
    task.status = 'IN_PROGRESS';
    task.started_at = new Date();
    await this.tasks.save(task);
    return { ok: true };
  }

  async completeTask(id: number, userId: number, actual_location_code?: string, notes?: string) {
    const task = await this.tasks.findOne({ where: { id }, relations: ['assigned_user', 'item'] });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.assigned_user || task.assigned_user.id !== userId) throw new ForbiddenException('Not your task');

    const finalLoc = actual_location_code || task.to_location_code;

    // Find location by code
    const location = await this.locations.findOne({ where: { code: finalLoc } });
    if (!location) {
      throw new NotFoundException(`Location ${finalLoc} not found`);
    }

    // Upsert inventory
    let inv = await this.inv.findOne({ where: { item_id: task.item.id, location_id: location.id } });
    if (!inv) {
      inv = this.inv.create({ item_id: task.item.id, location_id: location.id, quantity: String(task.quantity) });
    } else {
      inv.quantity = String(Number(inv.quantity) + Number(task.quantity));
    }
    await this.inv.save(inv);

    // Log movement - find from location if it's a real location code
    const fromLoc = await this.locations.findOne({ where: { code: task.from_location_code } }).catch(() => null);
    // Log movement using raw query (like receiving/shipping service does)
    await this.moves.manager.query(
      `INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [task.item.id, fromLoc?.id || null, location.id, Number(task.quantity), 'PUTAWAY', (task as any).reference_receiving_document?.id || null, userId]
    );

    task.to_location_code = finalLoc;
    task.status = 'DONE';
    task.completed_at = new Date();
    if (notes) task.notes = notes;
    await this.tasks.save(task);
    return { ok: true };
  }

  async blockTask(id: number, reason: string) {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    task.status = 'BLOCKED';
    task.notes = reason;
    await this.tasks.save(task);
    return { ok: true };
  }
}


