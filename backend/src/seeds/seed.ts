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

export async function seedDatabase(dataSource: DataSource) {
  const supplierRepo = dataSource.getRepository(Supplier);
  const itemRepo = dataSource.getRepository(Item);
  const stockLocationRepo = dataSource.getRepository(StockLocation);
  const receivingDocumentRepo = dataSource.getRepository(ReceivingDocument);
  const receivingItemRepo = dataSource.getRepository(ReceivingItem);
  const userRepo = dataSource.getRepository(User);
  const storeRepo = dataSource.getRepository(Store);

  // Always ensure base admin exists
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const ensureAdmin = async () => {
      const repo = dataSource.getRepository(User);
      const existingAdmin = await repo.findOne({
        where: [
          { role: 'ADMIN' as any },
          { role: 'admin' as any },
          { username: 'admin' },
        ],
      });
      if (existingAdmin) {
        if (!existingAdmin.password_hash) {
          existingAdmin.password_hash = await bcrypt.hash('Dekodera1989@', 10);
          existingAdmin.role = 'ADMIN';
          existingAdmin.is_active = true;
          (existingAdmin as any).active = true;
          await repo.save(existingAdmin);
        }
        return;
      }
      const admin = repo.create({
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
      await repo.save(admin);
    };
    await ensureAdmin();
  } catch (e) {
    console.log('Seed users skipped:', (e)?.message || e);
  }

  // Skip demo data seeding – leave database empty beyond ensured admin user
  console.log('✅ Base admin user ensured. Demo data seeding disabled.');

  await seedSkart(dataSource);
}
