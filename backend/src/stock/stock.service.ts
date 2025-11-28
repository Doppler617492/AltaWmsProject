import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StockLocation } from '../entities/stock-location.entity';
import { Item } from '../entities/item.entity';
import { Inventory } from '../entities/inventory.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { Location } from '../entities/location.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { PantheonItem } from '../entities/pantheon-item.entity';
import { Store } from '../entities/store.entity';
import { StoreInventory } from '../entities/store-inventory.entity';
import { PantheonCatalogService, SyncResult } from './pantheon-catalog.service';
import { CunguStockService } from '../integrations/cungu/cungu-stock.service';
import { SyncProgressService } from './sync-progress.service';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @InjectRepository(StockLocation)
    private stockLocationRepository: Repository<StockLocation>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(ReceivingItem)
    private receivingItemRepository: Repository<ReceivingItem>,
    @InjectRepository(PantheonItem)
    private pantheonItemRepository: Repository<PantheonItem>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(StoreInventory)
    private storeInventoryRepository: Repository<StoreInventory>,
    private readonly pantheonCatalogService: PantheonCatalogService,
    private readonly cunguStockService: CunguStockService,
    private readonly syncProgressService: SyncProgressService,
  ) {}

  // 5.1 — Pregled po artiklu
  async getByItem(params: { sku?: string; limit?: number; offset?: number }) {
    const { sku, limit = 100, offset = 0 } = params || {};
    if (sku) {
      // Single item detail with locations
      const it = await this.itemRepository.findOne({ where: { sku } });
      if (!it) return null;
      const rows = await this.inventoryRepository
        .createQueryBuilder('inv')
        .leftJoin(Location, 'loc', 'loc.id = inv.location_id')
        .select(['inv.location_id AS location_id', 'loc.code AS location_code', 'loc.rack_id AS rack_id', 'inv.quantity AS qty'])
        .where('inv.item_id = :itemId', { itemId: it.id })
        .getRawMany();
      const locations = rows.map(r => ({ location_code: r.location_code || String(r.location_id), zone: undefined as any, qty: parseFloat(String(r.qty || 0)) }));
      const total = locations.reduce((a, b) => a + (b.qty || 0), 0);
      return { sku: it.sku, naziv: it.name, total_qty: Number(total.toFixed(3)), locations };
    }
    // Aggregated by item
    const rows = await this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoin(Item, 'it', 'it.id = inv.item_id')
      .leftJoin(Location, 'loc', 'loc.id = inv.location_id')
      .select(['it.sku AS sku', 'it.name AS name', 'loc.code AS location_code', 'SUM(COALESCE(inv.quantity::numeric,0)) AS qty'])
      .groupBy('it.sku')
      .addGroupBy('it.name')
      .addGroupBy('loc.code')
      .orderBy('it.sku', 'ASC')
      .offset(offset)
      .limit(limit)
      .getRawMany();
    // Group locations per item
    const map = new Map<string, { sku: string; naziv: string; locations: any[] }>();
    for (const r of rows) {
      const key = r.sku;
      const rec = map.get(key) || { sku: r.sku, naziv: r.name, locations: [] as any[] };
      rec.locations.push({ location_code: r.location_code, qty: parseFloat(r.qty || '0') });
      map.set(key, rec);
    }
    const out = Array.from(map.values()).map(v => ({
      sku: v.sku,
      naziv: v.naziv,
      total_qty: Number(v.locations.reduce((a, b) => a + (b.qty || 0), 0).toFixed(3)),
      locations: v.locations,
    }));
    return out;
  }

  // New: Inventory overview using inventory_movements
  async getInventoryOverview() {
    // Pull incoming and outgoing aggregations separately
    const incoming = await this.movementRepository
      .createQueryBuilder('m')
      .select('m.to_location_id', 'location_id')
      .addSelect('m.item_id', 'item_id')
      .addSelect('SUM(m.quantity_change)', 'incoming_qty')
      .where('m.to_location_id IS NOT NULL')
      .groupBy('m.to_location_id')
      .addGroupBy('m.item_id')
      .getRawMany();

    const outgoing = await this.movementRepository
      .createQueryBuilder('m')
      .select('m.from_location_id', 'location_id')
      .addSelect('m.item_id', 'item_id')
      .addSelect('SUM(m.quantity_change)', 'outgoing_qty')
      .where('m.from_location_id IS NOT NULL')
      .groupBy('m.from_location_id')
      .addGroupBy('m.item_id')
      .getRawMany();

    // Merge results by (location_id, item_id)
    const key = (locId: number, itemId: number) => `${locId}:${itemId}`;
    const map = new Map<string, { location_id: number; item_id: number; qty: number }>();

    for (const row of incoming) {
      const loc = Number(row.location_id);
      const item = Number(row.item_id);
      const qty = Number(row.incoming_qty) || 0;
      const k = key(loc, item);
      const prev = map.get(k) || { location_id: loc, item_id: item, qty: 0 };
      prev.qty += qty;
      map.set(k, prev);
    }

    for (const row of outgoing) {
      const loc = Number(row.location_id);
      const item = Number(row.item_id);
      const qty = Number(row.outgoing_qty) || 0;
      const k = key(loc, item);
      const prev = map.get(k) || { location_id: loc, item_id: item, qty: 0 };
      prev.qty -= qty;
      map.set(k, prev);
    }

    // Resolve names/codes and group by location
    const itemsById = new Map<number, Item>();
    const locationsById = new Map<number, Location>();

    const loadItem = async (id: number) => {
      if (!itemsById.has(id)) {
        const it = await this.itemRepository.findOne({ where: { id } });
        if (it) itemsById.set(id, it);
      }
      return itemsById.get(id);
    };
    const loadLocation = async (id: number) => {
      if (!locationsById.has(id)) {
        const loc = await this.locationRepository.findOne({ where: { id } });
        if (loc) locationsById.set(id, loc);
      }
      return locationsById.get(id);
    };

    const rows: Array<{ location_id: number; location_code: string; item_id: number; sku: string; item_name: string; quantity: number; }> = [];
    for (const [, rec] of map) {
      if (!rec.location_id || rec.qty === 0) continue; // skip zero balances
      const [loc, it] = await Promise.all([loadLocation(rec.location_id), loadItem(rec.item_id)]);
      rows.push({
        location_id: rec.location_id,
        location_code: loc?.code || String(rec.location_id),
        item_id: rec.item_id,
        sku: it?.sku || String(rec.item_id),
        item_name: it?.name || '',
        quantity: rec.qty,
      });
    }

    // Group by location
    const grouped: Record<string, any> = {};
    for (const r of rows) {
      const keyLoc = `${r.location_id}`;
      if (!grouped[keyLoc]) {
        grouped[keyLoc] = { location_id: r.location_id, location_code: r.location_code, items: [] as any[] };
      }
      grouped[keyLoc].items.push({ item_id: r.item_id, sku: r.sku, name: r.item_name, quantity: r.quantity });
    }

    // Sort items by sku inside each location
    const result = Object.values(grouped).map((g: any) => ({
      ...g,
      items: g.items.sort((a: any, b: any) => a.sku.localeCompare(b.sku))
    })).sort((a: any, b: any) => a.location_code.localeCompare(b.location_code));

    return result;
  }

  async getAllLocationBalances() {
    // Flat list variant if needed by UI
    const overview = await this.getInventoryOverview();
    const flat: any[] = [];
    for (const loc of overview) {
      for (const it of loc.items) {
        flat.push({
          location_id: loc.location_id,
          location_code: loc.location_code,
          item_id: it.item_id,
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
        });
      }
    }
    return flat;
  }

  async getInventoryByDocument(docId: number) {
    // Load receiving items for document with minimal joins
    const recItems = await this.receivingItemRepository
      .createQueryBuilder('ri')
      .leftJoin('ri.item', 'it')
      .leftJoin('ri.location', 'loc')
      .select(['ri.id', 'ri.item_id', 'ri.location_id', 'ri.received_quantity', 'it.sku', 'it.name', 'loc.code'])
      .where('ri.receiving_document_id = :docId', { docId })
      .getRawMany();

    const out: any[] = [];
    for (const r of recItems) {
      const itemId = Number(r.ri_item_id);
      const locationId = Number(r.ri_location_id);
      const primljeno = Number(r.ri_received_quantity || 0);
      const inv = locationId ? await this.inventoryRepository.findOne({ where: { item_id: itemId, location_id: locationId } }) : null;
      out.push({
        sku: r.it_sku,
        naziv: r.it_name,
        lokacija: r.loc_code || '',
        primljeno,
        stanje_posle: inv ? parseFloat(inv.quantity as any) : primljeno,
      });
    }
    return out;
  }

  async getLocationDetail(locationId: number) {
    const [loc, incoming, outgoing] = await Promise.all([
      this.locationRepository.findOne({ where: { id: locationId } }),
      this.movementRepository
        .createQueryBuilder('m')
        .select('m.item_id', 'item_id')
        .addSelect('SUM(m.quantity_change)', 'qty')
        .where('m.to_location_id = :loc', { loc: locationId })
        .groupBy('m.item_id')
        .getRawMany(),
      this.movementRepository
        .createQueryBuilder('m')
        .select('m.item_id', 'item_id')
        .addSelect('SUM(m.quantity_change)', 'qty')
        .where('m.from_location_id = :loc', { loc: locationId })
        .groupBy('m.item_id')
        .getRawMany(),
    ]);

    const byItem = new Map<number, number>();
    for (const row of incoming) {
      const id = Number(row.item_id);
      const qty = Number(row.qty) || 0;
      byItem.set(id, (byItem.get(id) || 0) + qty);
    }
    for (const row of outgoing) {
      const id = Number(row.item_id);
      const qty = Number(row.qty) || 0;
      byItem.set(id, (byItem.get(id) || 0) - qty);
    }

    const items: Array<{ item_id: number; sku: string; name: string; quantity: number }> = [];
    for (const [itemId, qty] of byItem) {
      if (qty === 0) continue;
      const it = await this.itemRepository.findOne({ where: { id: itemId } });
      items.push({ item_id: itemId, sku: it?.sku || String(itemId), name: it?.name || '', quantity: qty });
    }

    items.sort((a, b) => a.sku.localeCompare(b.sku));

    return {
      location_id: locationId,
      location_code: loc?.code || String(locationId),
      items,
    };
  }

  // 5.1 — Pregled po lokaciji (by code)
  async getByLocationCode(locationCode: string) {
    if (!locationCode) {
      throw new Error('location_code je obavezan');
    }
    const loc = await this.locationRepository.findOne({ where: { code: locationCode }, relations: ['rack', 'rack.aisle', 'rack.aisle.zone'] as any });
    if (!loc) {
      // Fallback: virtual/staging codes that exist only in stock_locations
      const stockRows = await this.stockLocationRepository.find({ where: { location_code: locationCode } as any });
      if (!stockRows?.length) {
        const e: any = new Error('Lokacija nije pronađena');
        e.status = 404;
        throw e;
      }
      const byItem = new Map<number, { qty: number; uom?: string; pallet_id?: string|null }>();
      for (const sl of stockRows) {
        const cur = byItem.get(sl.item_id) || { qty: 0, uom: (sl as any).quantity_uom, pallet_id: (sl as any).pallet_id };
        cur.qty += Number((sl as any).quantity_value || 0);
        byItem.set(sl.item_id, cur);
      }
      const items: Array<{ sku: string; naziv: string; qty: number; uom?: string; pallet_id?: string|null }> = [];
      for (const [itemId, v] of byItem) {
        const it = await this.itemRepository.findOne({ where: { id: itemId } });
        items.push({ sku: it?.sku || String(itemId), naziv: it?.name || '', qty: v.qty, uom: v.uom, pallet_id: v.pallet_id || null });
      }
      items.sort((a, b) => a.sku.localeCompare(b.sku));
      return { location_code: locationCode, items };
    }
    const inv = await this.inventoryRepository.find({ where: { location_id: loc.id } });
    const items: Array<{ sku: string; naziv: string; qty: number; uom?: string; pallet_id?: string|null }> = [];
    for (const row of inv) {
      const it = await this.itemRepository.findOne({ where: { id: row.item_id } });
      // Try to enrich with a stock_location row (best-effort)
      const sl = await this.stockLocationRepository.findOne({ where: { location_id: loc.id, item_id: row.item_id } as any });
      items.push({ sku: it?.sku || String(row.item_id), naziv: it?.name || '', qty: parseFloat(String(row.quantity || '0')), uom: (sl as any)?.quantity_uom || undefined, pallet_id: (sl as any)?.pallet_id || null });
    }
    const used = items.reduce((a, b) => a + (b.qty || 0), 0);
    const cap = loc.capacity || 0;
    const fill = cap > 0 ? Math.round((used / cap) * 100) : null;
    return {
      location_code: loc.code,
      zone: (loc.rack as any)?.aisle?.zone?.name || null,
      aisle: (loc.rack as any)?.aisle?.code || null,
      rack: (loc.rack as any)?.name || null,
      shelf: loc.row ?? null,
      capacity: cap || null,
      used_capacity: used,
      fill_percent: fill,
      items,
    };
  }

  // 5.1 — Movements list
  async getMovements(params: { since?: string; locationCode?: string; itemSku?: string; limit?: number }) {
    const { since = '7d', locationCode, itemSku, limit = 50 } = params || {};
    // compute cutoff
    const now = new Date();
    let cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    if (since.endsWith('h')) {
      const h = parseInt(since);
      cutoff = new Date(now.getTime() - h * 3600 * 1000);
    } else if (since.endsWith('d')) {
      const d = parseInt(since);
      cutoff = new Date(now.getTime() - d * 24 * 3600 * 1000);
    }
    // build query with joins
    let qb = this.movementRepository
      .createQueryBuilder('m')
      .leftJoin(Item, 'it', 'it.id = m.item_id')
      .leftJoin(Location, 'fl', 'fl.id = m.from_location_id')
      .leftJoin(Location, 'tl', 'tl.id = m.to_location_id')
      .leftJoin('users', 'u', 'u.id = m.created_by')
      .leftJoin('receiving_documents', 'd', 'd.id = m.reference_document_id')
      .select([
        'm.created_at AS created_at',
        'u.full_name AS user_full_name',
        'm.reason AS reason',
        'it.sku AS item_sku',
        'it.name AS item_name',
        'm.quantity_change AS quantity_change',
        'fl.code AS from_location_code',
        'tl.code AS to_location_code',
        'd.document_number AS reference_document_number',
      ])
      .where('m.created_at >= :cutoff', { cutoff: cutoff.toISOString() })
      .orderBy('m.created_at', 'DESC')
      .limit(limit);
    if (locationCode) {
      qb = qb.andWhere('(fl.code = :lc OR tl.code = :lc)', { lc: locationCode });
    }
    if (itemSku) {
      qb = qb.andWhere('it.sku = :sku', { sku: itemSku });
    }
    const rows = await qb.getRawMany();
    return rows.map(r => ({
      timestamp: r.created_at,
      user_full_name: r.user_full_name || null,
      reason: r.reason,
      item_sku: r.item_sku,
      item_name: r.item_name,
      quantity_change: Number(r.quantity_change),
      from_location_code: r.from_location_code || null,
      to_location_code: r.to_location_code || null,
      reference_document_number: r.reference_document_number || null,
    }));
  }

  // 5.1 — Hotspots
  async getHotspots() {
    // Overloaded and negative
    const inv = await this.inventoryRepository
      .createQueryBuilder('inv')
      .leftJoin(Location, 'loc', 'loc.id = inv.location_id')
      .select(['loc.code AS location_code', 'loc.capacity AS capacity', 'SUM(inv.quantity::numeric) AS qty'])
      .groupBy('loc.code')
      .addGroupBy('loc.capacity')
      .getRawMany();
    const overloaded: any[] = [];
    const negative: any[] = [];
    for (const r of inv) {
      const qty = parseFloat(String(r.qty || '0'));
      const cap = Number(r.capacity || 0);
      if (qty < 0) negative.push({ location_code: r.location_code, qty });
      if (cap > 0 && qty > cap) {
        overloaded.push({ location_code: r.location_code, fill_percent: Math.round((qty / cap) * 100) });
      }
    }
    // Recent conflicts: last movement per (item, location)
    const last = await this.movementRepository
      .createQueryBuilder('m')
      .leftJoin(Item, 'it', 'it.id = m.item_id')
      .leftJoin(Location, 'tl', 'tl.id = m.to_location_id')
      .select(['it.sku AS sku', 'tl.code AS location_code', 'm.quantity_change AS quantity_change', 'm.created_at AS created_at'])
      .orderBy('m.created_at', 'DESC')
      .limit(200)
      .getRawMany();
    const recent_conflicts: any[] = [];
    for (const r of last) {
      if (!r.location_code) continue;
      // compare movement magnitude to current inventory at that location
      const loc = await this.locationRepository.findOne({ where: { code: r.location_code } });
      if (!loc) continue;
      const item = await this.itemRepository.findOne({ where: { sku: r.sku } });
      if (!item) continue;
      const invRow = await this.inventoryRepository.findOne({ where: { item_id: item.id, location_id: loc.id } });
      const current = invRow ? parseFloat(String(invRow.quantity)) : 0;
      const diff = Math.abs(Number(r.quantity_change || 0));
      if (current > 0 && diff / current > 0.1) {
        recent_conflicts.push({ sku: r.sku, location_code: r.location_code, difference: Number(r.quantity_change), last_movement_at: r.created_at });
      }
    }
    return { overloaded, negative, recent_conflicts };
  }

  async getPantheonItems(params: { search?: string; limit?: number; offset?: number }) {
    return this.pantheonCatalogService.listItems(params);
  }

  async syncPantheonItems(options?: { force?: boolean; full?: boolean }): Promise<SyncResult> {
    return this.pantheonCatalogService.syncCatalog(options);
  }

  async syncCatalog(options?: { full?: boolean }): Promise<SyncResult> {
    return this.pantheonCatalogService.syncCatalog(options);
  }

  // Get all stores/warehouses
  async getStores() {
    return this.storeRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  // Get inventory for a specific store using Cungu getStock API
  // The API returns Objekti array with per-store quantities
  async getStoreInventory(storeId: number) {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    // Read from database instead of live API
    const inventoryItems = await this.storeInventoryRepository.find({
      where: { store_id: storeId },
      order: { item_ident: 'ASC' },
    });

    return {
      store_id: store.id,
      store_name: store.name,
      store_code: store.code,
      items: inventoryItems.map(item => ({
        sku: item.item_ident,
        name: item.item_name || item.item_ident,
        quantity: Number(item.quantity),
        uom: 'KOM',
      })),
      total_items: inventoryItems.length,
      last_synced: inventoryItems[0]?.last_synced_at?.toISOString() || null,
    };
  }

  // Sync inventory for all stores from Cungu API
  async syncAllStoreInventory(syncId: string) {
    const stores = await this.storeRepository.find({ where: { is_active: true } });
    
    this.syncProgressService.startSync(syncId, 'all_stores', stores.length);
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let errors: string[] = [];

    try {
      // Fetch all stock items ONCE (with pagination handled internally)
      this.logger.log('📥 Fetching all stock items from Cungu (one-time with pagination)...');
      const allStockItems = await this.cunguStockService.fetchStockItems({
        minQuantity: 0,
      });
      this.logger.log(`📥 Fetched ${allStockItems.length} total items. Processing for ${stores.length} stores...`);

      for (let i = 0; i < stores.length; i++) {
        // Check if cancelled
        if (this.syncProgressService.isCancelled(syncId)) {
          this.syncProgressService.cancelSync(syncId);
          return {
            total_stores: stores.length,
            synced_stores: i,
            total_created: totalCreated,
            total_updated: totalUpdated,
            cancelled: true,
            errors: errors.length > 0 ? errors : undefined,
          };
        }

        const store = stores[i];
        this.syncProgressService.updateProgress(
          syncId,
          i + 1,
          `Sinhronizujem ${store.name} (${i + 1}/${stores.length})...`,
        );

        try {
          const result = await this.syncStoreInventoryWithSharedData(store.id, allStockItems);
          totalCreated += result.created;
          totalUpdated += result.updated;
        } catch (error) {
          errors.push(`${store.name}: ${error.message}`);
        }
      }

      const result = {
        total_stores: stores.length,
        total_created: totalCreated,
        total_updated: totalUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };

      this.syncProgressService.completeSync(syncId, result);
      return result;
    } catch (error) {
      this.syncProgressService.errorSync(syncId, error.message);
      throw error;
    }
  }

  // Sync inventory for a specific store
  async syncStoreInventory(storeId: number) {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    // Fetch all stock items with Objekti breakdown from Cungu API
    const stockItems = await this.cunguStockService.fetchStockItems({
      minQuantity: 0, // Get all items including zero stock
    });

    // Filter for this specific store using the Objekti array
    const storeInventory = this.cunguStockService.getStoreInventoryFromStock(
      stockItems,
      store.name,
      store.code,
    );

    // Fetch article names from Pantheon catalog (Veleprodajni Magacin)
    const skus = storeInventory.map(item => item.sku);
    const items = skus.length > 0 ? await this.pantheonItemRepository.find({
      where: { ident: In(skus) },
      select: ['ident', 'naziv'],
    }) : [];

    const itemMap = new Map(items.map(i => [i.ident, i.naziv]));

    // Upsert into store_inventory table
    let created = 0;
    let updated = 0;

    for (const item of storeInventory) {
      const itemName = itemMap.get(item.sku);
      const existingRecord = await this.storeInventoryRepository.findOne({
        where: { store_id: storeId, item_ident: item.sku },
      });

      if (existingRecord) {
        existingRecord.quantity = item.quantity;
        existingRecord.item_name = itemName || item.sku;
        existingRecord.last_synced_at = new Date();
        await this.storeInventoryRepository.save(existingRecord);
        updated++;
      } else {
        const newRecord = this.storeInventoryRepository.create({
          store_id: storeId,
          item_ident: item.sku,
          item_name: itemName || item.sku,
          quantity: item.quantity,
          last_synced_at: new Date(),
        });
        await this.storeInventoryRepository.save(newRecord);
        created++;
      }
    }

    return {
      store_id: storeId,
      store_name: store.name,
      created,
      updated,
      total: created + updated,
    };
  }

  // Sync inventory for a specific store using pre-fetched stock items
  async syncStoreInventoryWithSharedData(storeId: number, allStockItems: any[]) {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    // Filter for this specific store using the pre-fetched Objekti array
    const storeInventory = this.cunguStockService.getStoreInventoryFromStock(
      allStockItems,
      store.name,
      store.code,
    );

    // Fetch article names from Pantheon catalog (Veleprodajni Magacin)
    const skus = storeInventory.map(item => item.sku);
    const items = skus.length > 0 ? await this.pantheonItemRepository.find({
      where: { ident: In(skus) },
      select: ['ident', 'naziv'],
    }) : [];

    const itemMap = new Map(items.map(i => [i.ident, i.naziv]));

    // Upsert into store_inventory table
    let created = 0;
    let updated = 0;

    for (const item of storeInventory) {
      const itemName = itemMap.get(item.sku);
      const existingRecord = await this.storeInventoryRepository.findOne({
        where: { store_id: storeId, item_ident: item.sku },
      });

      if (existingRecord) {
        existingRecord.quantity = item.quantity;
        existingRecord.item_name = itemName || item.sku;
        existingRecord.last_synced_at = new Date();
        await this.storeInventoryRepository.save(existingRecord);
        updated++;
      } else {
        const newRecord = this.storeInventoryRepository.create({
          store_id: storeId,
          item_ident: item.sku,
          item_name: itemName || item.sku,
          quantity: item.quantity,
          last_synced_at: new Date(),
        });
        await this.storeInventoryRepository.save(newRecord);
        created++;
      }
    }

    return {
      store_id: storeId,
      store_name: store.name,
      created,
      updated,
      total: created + updated,
    };
  }

  // Sync inventory for a specific store using page data (memory-efficient page processing)
  async syncStoreInventoryWithPageData(storeId: number, pageStockItems: any[]) {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    // Filter for this specific store from the page data
    const storeInventory = this.cunguStockService.getStoreInventoryFromStock(
      pageStockItems,
      store.name,
      store.code,
    );

    if (storeInventory.length === 0) {
      // No items for this store in this page
      return {
        store_id: storeId,
        store_name: store.name,
        created: 0,
        updated: 0,
        total: 0,
      };
    }

    // Fetch article names from Pantheon catalog for items in this page
    const skus = storeInventory.map(item => item.sku);
    const items = skus.length > 0 ? await this.pantheonItemRepository.find({
      where: { ident: In(skus) },
      select: ['ident', 'naziv'],
    }) : [];

    const itemMap = new Map(items.map(i => [i.ident, i.naziv]));

    // Upsert into store_inventory table
    let created = 0;
    let updated = 0;

    for (const item of storeInventory) {
      const itemName = itemMap.get(item.sku);
      const existingRecord = await this.storeInventoryRepository.findOne({
        where: { store_id: storeId, item_ident: item.sku },
      });

      if (existingRecord) {
        existingRecord.quantity = item.quantity;
        existingRecord.item_name = itemName || item.sku;
        existingRecord.last_synced_at = new Date();
        await this.storeInventoryRepository.save(existingRecord);
        updated++;
      } else {
        const newRecord = this.storeInventoryRepository.create({
          store_id: storeId,
          item_ident: item.sku,
          item_name: itemName || item.sku,
          quantity: item.quantity,
          last_synced_at: new Date(),
        });
        await this.storeInventoryRepository.save(newRecord);
        created++;
      }
    }

    return {
      store_id: storeId,
      store_name: store.name,
      created,
      updated,
      total: created + updated,
    };
  }
}
