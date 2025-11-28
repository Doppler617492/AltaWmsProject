import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../entities/store.entity';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { AuthModule } from '../auth/auth.module';
import { CunguModule } from '../integrations/cungu/cungu.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store]),
    AuthModule,
    CunguModule,
  ],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}

