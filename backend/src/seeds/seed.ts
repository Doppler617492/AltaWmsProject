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

  // Always ensure demo users exist
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const ensure = async (u: Partial<User> & { username: string; password?: string }) => {
      const repo = dataSource.getRepository(User);
      let row = await repo.findOne({ where: { username: u.username } });
      if (!row) row = repo.create({ username: u.username } as Partial<User>);
      row.full_name = (u as any).full_name || (u as any).name || u.username;
      row.name = row.full_name;
      row.role = (u as any).role || 'admin';
      (row as any).shift = (u as any).shift || 'PRVA';
      row.is_active = true; (row as any).active = true;
      row.email = `${u.username}@altawms.local`;
      if ((u as any).password) {
        (row as any).password_hash = await bcrypt.hash((u as any).password, 10);
      }
      await repo.save(row);
    };
    await ensure({ username: 'admin', full_name: 'System Admin', role: 'admin', shift: 'PRVA', password: 'admin' });
  } catch (e) {
    console.log('Seed users skipped:', (e)?.message || e);
  }

  // Skip demo data seeding – leave database empty beyond ensured admin user
  console.log('✅ Base admin user ensured. Demo data seeding disabled.');

  await seedSkart(dataSource);
}
