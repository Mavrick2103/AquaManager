import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FishCard } from './fish-card.entity';
import { FishCardsService } from './fish-card.service';
import { FishCardsController } from './fish-card.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FishCard])],
  controllers: [FishCardsController],
  providers: [FishCardsService],
  exports: [FishCardsService],
})
export class FishCardsModule {}
