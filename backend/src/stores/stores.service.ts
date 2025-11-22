import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Store } from '../entities/store.entity';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
  ) {}

  async findAll(): Promise<Store[]> {
    return this.storeRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findByCodes(codes: string[]): Promise<Store[]> {
    if (!codes.length) return [];
    return this.storeRepository.find({
      where: { code: In(codes) },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Store> {
    return this.storeRepository.findOne({ where: { id } });
  }

  async create(storeData: Partial<Store>): Promise<Store> {
    const store = this.storeRepository.create(storeData);
    return this.storeRepository.save(store);
  }

  async update(id: number, storeData: Partial<Store>): Promise<Store> {
    await this.storeRepository.update(id, storeData);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.storeRepository.delete(id);
  }
}

