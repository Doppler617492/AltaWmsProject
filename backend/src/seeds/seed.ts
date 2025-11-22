import { DataSource } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { Item } from '../entities/item.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { ReceivingItem, ItemStatus } from '../entities/receiving-item.entity';
import { User } from '../entities/user.entity';
import { Store } from '../entities/store.entity';
import { seedWarehouse } from './warehouse-seed';
import { seedSkart } from './skart-seed';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';

export async function seedDatabase(dataSource: DataSource) {
  const supplierRepo = dataSource.getRepository(Supplier);
  const itemRepo = dataSource.getRepository(Item);
  const stockLocationRepo = dataSource.getRepository(StockLocation);
  const receivingDocumentRepo = dataSource.getRepository(ReceivingDocument);
  const receivingItemRepo = dataSource.getRepository(ReceivingItem);
  const userRepo = dataSource.getRepository(User);
  const storeRepo = dataSource.getRepository(Store);
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);
  const rolePermRepo = dataSource.getRepository(RolePermission);
  const userRoleRepo = dataSource.getRepository(UserRole);

  // Always ensure base RBAC + admin exists
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const ensureRole = async (name: string) => {
      let role = await roleRepo.findOne({ where: { name } });
      if (!role) {
        role = roleRepo.create({ name });
        await roleRepo.save(role);
      }
      return role;
    };
    const ensurePermission = async (name: string) => {
      let perm = await permRepo.findOne({ where: { name } });
      if (!perm) {
        perm = permRepo.create({ name });
        await permRepo.save(perm);
      }
      return perm;
    };
    const ensureRolePermission = async (role: Role, perm: Permission) => {
      const exists = await rolePermRepo.findOne({ where: { role: { id: role.id }, permission: { id: perm.id } } });
      if (!exists) {
        const rp = rolePermRepo.create({ role, permission: perm });
        await rolePermRepo.save(rp);
      }
    };
    const ensureUserRole = async (user: User, role: Role) => {
      const exists = await userRoleRepo.findOne({ where: { user: { id: user.id }, role: { id: role.id } } });
      if (!exists) {
        const ur = userRoleRepo.create({ user, role });
        await userRoleRepo.save(ur);
      }
    };

    const adminRole = await ensureRole('ADMIN');
    await ensureRole('MANAGER');
    await ensureRole('WORKER');

    const permissionNames = [
      'dashboard:view',
      'workforce:read',
      'stock:read',
      'stock:hotspots',
      'performance:read',
      'receiving:read',
      'shipping:read',
      'kpi:read',
      'exceptions:read',
      'sla:read',
      'labels:read',
      'putaway:read',
      'cyclecount:read',
      'users:read',
      'users:write',
      'teams:read',
      'teams:write',
      'povracaj:read',
      'skart:read',
      'warehouse:read',
      'relayout:read',
      'orchestration:read',
      'pwa:read',
    ];
    const perms = [];
    for (const p of permissionNames) {
      perms.push(await ensurePermission(p));
    }
    for (const perm of perms) {
      await ensureRolePermission(adminRole, perm);
    }

    const ensureAdmin = async () => {
      let admin: User | null = await userRepo.findOne({
        where: [
          { role: 'ADMIN' as any },
          { role: 'admin' as any },
          { username: 'admin' },
        ],
      });
      if (!admin) {
        admin = userRepo.create({
          username: 'admin',
          name: 'System Admin',
          full_name: 'System Admin',
          role: 'ADMIN',
          shift: 'PRVA',
          is_active: true,
          active: true,
          email: 'admin@altawms.local',
          password_hash: await bcrypt.hash('Dekodera1989@', 10),
        } as any);
      } else {
        admin.role = 'ADMIN';
        admin.is_active = true;
        (admin as any).active = true;
        if (!admin.password_hash) {
          admin.password_hash = await bcrypt.hash('Dekodera1989@', 10);
        }
      }
      await userRepo.save(admin);
      await ensureUserRole(admin, adminRole);
    };
    await ensureAdmin();
  } catch (e) {
    console.log('Seed users skipped:', (e)?.message || e);
  }

  // Skip demo data seeding – leave database empty beyond ensured admin user
  console.log('✅ Base admin user ensured. Demo data seeding disabled.');

  await seedSkart(dataSource);
}
