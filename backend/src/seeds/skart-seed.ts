import { DataSource } from 'typeorm';
import { Store } from '../entities/store.entity';

export async function seedSkart(dataSource: DataSource) {
  const storeRepo = dataSource.getRepository(Store);
  const defaultStores = [
    { name: 'Prodavnica - Ulcinj Centar', code: 'PRODAVNICA_ULCINJ_CENTAR' },
    { name: 'Prodavnica - Bar', code: 'PRODAVNICA_BAR' },
    { name: 'Prodavnica - Bar Centar', code: 'PRODAVNICA_BAR_CENTAR' },
    { name: 'Prodavnica - Budva 2', code: 'PRODAVNICA_BUDVA_2' },
    { name: 'Prodavnica - Kotor Centar', code: 'PRODAVNICA_KOTOR_CENTAR' },
    { name: 'Prodavnica - Herceg Novi', code: 'PRODAVNICA_HERCEG_NOVI' },
    { name: 'Prodavnica - H.Novi Centar', code: 'PRODAVNICA_HNOVICENTAR' },
    { name: 'Prodavnica - Niksic', code: 'PRODAVNICA_NIKSIC' },
    { name: 'Prodavnica - Podgorica 2', code: 'PRODAVNICA_PODGORICA_2' },
    { name: 'Prodavnica - Podgorica Centar', code: 'PRODAVNICA_PODGORICA_CENTAR' },
    { name: 'Prodavnica Bijelo Polje', code: 'PRODAVNICA_BIJELO_POLJE' },
    { name: 'Prodavnica - Berane', code: 'PRODAVNICA_BERANE' },
  ];

  for (const def of defaultStores) {
    const exists = await storeRepo.findOne({ where: { code: def.code } });
    if (!exists) {
      const store = storeRepo.create({ name: def.name, code: def.code, is_active: true });
      await storeRepo.save(store);
    }
  }
}


