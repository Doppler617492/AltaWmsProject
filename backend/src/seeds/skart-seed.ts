import { DataSource } from 'typeorm';
import { Store } from '../entities/store.entity';

export async function seedSkart(dataSource: DataSource) {
  const storeRepo = dataSource.getRepository(Store);
  const defaultStores = [
    { name: 'MP Ulcinj', code: 'MP_ULCINJ' },
    { name: 'MP Ulcinj Centar', code: 'MP_ULCINJ_CENTAR' },
    { name: 'MP Bar', code: 'MP_BAR' },
    { name: 'MP Bar Centar', code: 'MP_BAR_CENTAR' },
    { name: 'MP Budva', code: 'MP_BUDVA' },
    { name: 'MP Kotor Centar', code: 'MP_KOTOR_CENTAR' },
    { name: 'MP Herceg Novi', code: 'MP_HERCEG_NOVI' },
    { name: 'MP Sutorina', code: 'MP_SUTORINA' },
    { name: 'MP Nikšić', code: 'MP_NIKSIC' },
    { name: 'MP Podgorica', code: 'MP_PODGORICA' },
    { name: 'MP Podgorica Centar', code: 'MP_PODGORICA_CENTAR' },
    { name: 'MP Bijelo Polje', code: 'MP_BIJELO_POLJE' },
    { name: 'MP Berane', code: 'MP_BERANE' },
  ];

  for (const def of defaultStores) {
    const exists = await storeRepo.findOne({ where: { code: def.code } });
    if (!exists) {
      const store = storeRepo.create({ name: def.name, code: def.code, is_active: true });
      await storeRepo.save(store);
    }
  }
}


