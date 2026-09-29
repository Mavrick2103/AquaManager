import {
  Body,
  Req,
  NotFoundException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AquariumFishCard } from './aquarium-fish-card.entity';
import { AquariumPlantCard } from './aquarium-plant-card.entity';
import { Aquarium } from '../../aquariums/aquariums.entity';
import { AddAquariumItemDto } from './dto/add-aquarium-item.dto';

@Controller('aquariums')
@UseGuards(JwtAuthGuard)
export class AquariumItemsController {
  constructor(
    @InjectRepository(Aquarium) private readonly aquariumRepo: Repository<Aquarium>,
    @InjectRepository(AquariumFishCard)
    private readonly fishRepo: Repository<AquariumFishCard>,
    @InjectRepository(AquariumPlantCard)
    private readonly plantRepo: Repository<AquariumPlantCard>,
  ) {}

  private async assertOwner(aquariumId: number, userId: number) {
    if (!Number.isInteger(aquariumId) || aquariumId <= 0) throw new BadRequestException('Invalid aquariumId');
    if (!Number.isInteger(userId) || !await this.aquariumRepo.existsBy({ id: aquariumId, user: { id: userId } })) {
      throw new NotFoundException('Aquarium introuvable');
    }
  }

  // =========================
  // ===== FISH =====
  // =========================

  @Get(':id/fish')
  async listFish(@Req() req: { user: { userId: number } }, @Param('id') id: string) {
    const aquariumId = Number(id);
    await this.assertOwner(aquariumId, req.user.userId);
    if (!aquariumId) throw new BadRequestException('Invalid aquariumId');

    const rows = await this.fishRepo.find({
      where: { aquariumId } as any,
      order: { createdAt: 'DESC' },
      relations: { fishCard: true },
    });

    return rows.map((r) => ({
      id: r.id,
      aquariumId: r.aquariumId,
      count: r.count,
      fishCard: {
        id: r.fishCard?.id ?? null,
        commonName: r.fishCard?.commonName ?? null,
        scientificName: r.fishCard?.scientificName ?? null,
        imageUrl: r.fishCard?.imageUrl ?? null,
        waterType: r.fishCard?.waterType ?? null,

        tempMin: r.fishCard?.tempMin ?? null,
        tempMax: r.fishCard?.tempMax ?? null,
        phMin: r.fishCard?.phMin ?? null,
        phMax: r.fishCard?.phMax ?? null,
        khMin: r.fishCard?.khMin ?? null,
        khMax: r.fishCard?.khMax ?? null,
      },
    }));
  }

  @Post(':id/fish')
  async addFish(@Req() req: { user: { userId: number } }, @Param('id') id: string, @Body() dto: AddAquariumItemDto) {
    const aquariumId = Number(id);
    await this.assertOwner(aquariumId, req.user.userId);
    if (!aquariumId) throw new BadRequestException('Invalid aquariumId');

    const existing = await this.fishRepo.findOne({
      where: { aquariumId, fishCardId: dto.cardId } as any,
    });

    if (existing) {
      existing.count = Math.max(1, Number(dto.count) || 1);
      return this.fishRepo.save(existing);
    }

    const row = this.fishRepo.create({
      aquariumId,
      fishCardId: dto.cardId,
      count: Math.max(1, Number(dto.count) || 1),
    });

    return this.fishRepo.save(row);
  }

  @Delete(':id/fish/:rowId')
  async removeFish(@Req() req: { user: { userId: number } }, @Param('id') id: string, @Param('rowId') rowId: string) {
    const aquariumId = Number(id);
    await this.assertOwner(aquariumId, req.user.userId);
    const rid = Number(rowId);
    if (!aquariumId || !rid) throw new BadRequestException('Invalid ids');

    await this.fishRepo.delete({ id: rid, aquariumId } as any);
    return { ok: true };
  }

  // =========================
  // ===== PLANTS ===== (inchangé)
  // =========================

  @Get(':id/plants')
  async listPlants(@Req() req: { user: { userId: number } }, @Param('id') id: string) {
    const aquariumId = Number(id);
    await this.assertOwner(aquariumId, req.user.userId);
    if (!aquariumId) throw new BadRequestException('Invalid aquariumId');

    const rows = await this.plantRepo.find({
      where: { aquariumId } as any,
      order: { createdAt: 'DESC' },
    });

    return rows.map((r) => ({
      id: r.id,
      aquariumId: r.aquariumId,
      count: r.count,
      plantCard: {
        id: (r.plantCard as any)?.id,
        commonName: (r.plantCard as any)?.commonName,
        scientificName: (r.plantCard as any)?.scientificName ?? null,
        imageUrl: (r.plantCard as any)?.imageUrl ?? null,
        waterType: (r.plantCard as any)?.waterType ?? null,
      },
    }));
  }

  @Post(':id/plants')
  async addPlant(@Req() req: { user: { userId: number } }, @Param('id') id: string, @Body() dto: AddAquariumItemDto) {
    const aquariumId = Number(id);
    await this.assertOwner(aquariumId, req.user.userId);
    if (!aquariumId) throw new BadRequestException('Invalid aquariumId');

    const existing = await this.plantRepo.findOne({
      where: { aquariumId, plantCardId: dto.cardId } as any,
    });

    if (existing) {
      existing.count = Math.max(1, Number(dto.count) || 1);
      return this.plantRepo.save(existing);
    }

    const row = this.plantRepo.create({
      aquariumId,
      plantCardId: dto.cardId,
      count: Math.max(1, Number(dto.count) || 1),
    });

    return this.plantRepo.save(row);
  }

  @Delete(':id/plants/:rowId')
  async removePlant(@Req() req: { user: { userId: number } }, @Param('id') id: string, @Param('rowId') rowId: string) {
    const aquariumId = Number(id);
    await this.assertOwner(aquariumId, req.user.userId);
    const rid = Number(rowId);
    if (!aquariumId || !rid) throw new BadRequestException('Invalid ids');

    await this.plantRepo.delete({ id: rid, aquariumId } as any);
    return { ok: true };
  }
}
