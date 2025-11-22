import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { Store } from '../entities/store.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ReceivingDocument) private readonly docRepo: Repository<ReceivingDocument>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
  ) {}

  private ensureAdmin(role: string) {
    if (!['admin', 'sef_magacina', 'sef'].includes(role)) {
      throw new ForbiddenException('Samo admin i šef magacina imaju pristup.');
    }
  }

  async list(actorRole: string) {
    this.ensureAdmin(actorRole);
    const users = await this.userRepo.find({ relations: ['store'] });
    const ids = users.map(u => u.id);
    const open = await this.docRepo
      .createQueryBuilder('d')
      .select('d.assigned_to', 'assigned_to')
      .addSelect('COUNT(*)', 'cnt')
      .where('d.status IN (:...st)', { st: [ReceivingStatus.IN_PROGRESS, ReceivingStatus.ON_HOLD] })
      .andWhere('d.assigned_to IN (:...ids)', { ids })
      .groupBy('d.assigned_to')
      .getRawMany();
    const map = new Map<number, number>();
    open.forEach(r => map.set(Number(r.assigned_to), Number(r.cnt)));
    return users.map(u => ({
      id: u.id,
      full_name: u.full_name || u.name,
      username: u.username,
      role: u.role,
      shift: u.shift || 'OFF',
      active: u.active ?? u.is_active,
      last_heartbeat_at: u.last_activity || null,
      open_tasks_count: map.get(u.id) || 0,
      store_id: u.store_id,
      store_name: u.store?.name || null,
      store_code: u.store?.code || null,
    }));
  }

  async create(actorRole: string, body: { full_name: string; username: string; password: string; role: string; shift: string; store_id?: number | null; }) {
    this.ensureAdmin(actorRole);
    const exists = await this.userRepo.findOne({ where: { username: body.username } });
    if (exists) throw new BadRequestException('Username već postoji');
    let store: Store | null = null;
    if (body.store_id) {
      store = await this.storeRepo.findOne({ where: { id: body.store_id } });
      if (!store) throw new BadRequestException('Prodavnica ne postoji');
    }
    if (body.role === 'sef_prodavnice' && !store) {
      throw new BadRequestException('Šef prodavnice mora imati dodeljenu prodavnicu.');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(body.password, 10);
    const user = this.userRepo.create({
      full_name: body.full_name,
      name: body.full_name,
      username: body.username,
      role: body.role,
      shift: body.shift,
      is_active: true,
      active: true,
      email: `${body.username}@example.com`,
      password_hash: hash,
      store_id: store ? store.id : null,
    });
    return await this.userRepo.save(user);
  }

  async update(actorRole: string, id: number, body: { full_name?: string; role?: string; shift?: string; active?: boolean; store_id?: number | null; }) {
    this.ensureAdmin(actorRole);
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new BadRequestException('Korisnik ne postoji');
    // Restrikcije uloga: samo admin može menjati admina ili dodeliti admin
    if (body.role) {
      const targetIsAdmin = user.role === 'admin';
      const makingAdmin = body.role === 'admin';
      if (actorRole !== 'admin' && (targetIsAdmin || makingAdmin)) {
        throw new ForbiddenException('Samo admin može menjati/dodeliti administratorsku ulogu.');
      }
    }
    if (body.full_name !== undefined) { user.full_name = body.full_name; user.name = body.full_name; }
    if (body.role !== undefined) user.role = body.role;
    if (body.shift !== undefined) user.shift = body.shift;
    if (body.active !== undefined) { user.active = body.active; user.is_active = body.active; }
    if (body.store_id !== undefined) {
      if (body.store_id === null) {
        user.store_id = null;
      } else {
        const store = await this.storeRepo.findOne({ where: { id: body.store_id } });
        if (!store) throw new BadRequestException('Prodavnica ne postoji');
        user.store_id = store.id;
      }
    }
    if (user.role === 'sef_prodavnice' && !user.store_id) {
      throw new BadRequestException('Šef prodavnice mora imati dodeljenu prodavnicu.');
    }
    await this.userRepo.save(user);
    return { ok: true };
  }

  async resetPassword(actorRole: string, id: number, newPassword: string) {
    this.ensureAdmin(actorRole);
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new BadRequestException('Korisnik ne postoji');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    return { ok: true };
  }

  async remove(actorRole: string, actorId: number, id: number) {
    if (actorRole !== 'admin') {
      throw new ForbiddenException('Brisanje korisnika dozvoljeno je samo administratoru.');
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('Korisnik ne postoji');
    }
    if (user.id === actorId) {
      throw new BadRequestException('Ne možete obrisati sopstveni nalog.');
    }
    if (user.role === 'admin') {
      const admins = await this.userRepo.count({ where: { role: 'admin' as any } });
      if (admins <= 1) {
        throw new BadRequestException('Ne možete obrisati poslednjeg administratora.');
      }
    }
    await this.userRepo.delete(id);
    return { ok: true };
  }
}
