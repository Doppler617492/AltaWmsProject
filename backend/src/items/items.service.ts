import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '../entities/item.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { Inventory } from '../entities/inventory.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(StockLocation)
    private stockLocationRepository: Repository<StockLocation>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
  ) {}

  async findAll(search?: string) {
    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.supplier', 'supplier');

    if (search) {
      queryBuilder.where(
        '(item.sku ILIKE :search OR item.name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const items = await queryBuilder.getMany();
    
    // Add total quantity for each item from inventory
    const itemsWithQuantities = await Promise.all(
      items.map(async (item) => {
        const inventoryRows = await this.inventoryRepository
          .createQueryBuilder('inv')
          .select('SUM(COALESCE(inv.quantity::numeric, 0))', 'total_qty')
          .where('inv.item_id = :itemId', { itemId: item.id })
          .getRawOne();
        
        const totalQty = inventoryRows?.total_qty 
          ? parseFloat(String(inventoryRows.total_qty)) 
          : 0;
        
        return {
          ...item,
          total_quantity: Number(totalQty.toFixed(3)),
        };
      })
    );

    return itemsWithQuantities;
  }

  async getStock(itemId: number) {
    return this.stockLocationRepository
      .createQueryBuilder('stock')
      .where('stock.item_id = :itemId', { itemId })
      .getMany();
  }
}
