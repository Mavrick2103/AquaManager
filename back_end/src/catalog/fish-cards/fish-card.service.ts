import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { FishCard, normalizeText, WaterType } from './fish-card.entity';
import { CreateFishCardDto } from './dto/create-fish-card.dto';
import { UpdateFishCardDto } from './dto/update-fish-card.dto';

import { join } from 'path';
import { promises as fs } from 'fs';

function getUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

function isDuplicateDbError(err: any): boolean {
  // MySQL
  if (err?.code === 'ER_DUP_ENTRY') return true;
  // PostgreSQL
  if (err?.code === '23505') return true;
  return false;
}

type DuplicateInput = {
  commonName?: string | null;
  scientificName?: string | null;
  waterType?: WaterType | null;
};

@Injectable()
export class FishCardsService {
  constructor(
    @InjectRepository(FishCard) private readonly repo: Repository<FishCard>,
  ) {}

  private async findDuplicateId(input: DuplicateInput, excludeId?: number): Promise<number | null> {
    const commonName = (input.commonName ?? '').trim();
    if (!commonName) return null;

    const waterType = input.waterType ?? null;
    if (!waterType) throw new BadRequestException('waterType is required');

    const commonNorm = normalizeText(commonName) ?? '';
    const sciNorm = normalizeText(input.scientificName ?? null);

    const dupCommon = await this.repo.findOne({
      where: { waterType, commonNameNormalized: commonNorm } as any,
      select: { id: true } as any,
    });
    if (dupCommon && dupCommon.id !== excludeId) return dupCommon.id;

    if (sciNorm) {
      const dupSci = await this.repo.findOne({
        where: { waterType, scientificNameNormalized: sciNorm } as any,
        select: { id: true } as any,
      });
      if (dupSci && dupSci.id !== excludeId) return dupSci.id;
    }

    return null;
  }

  async create(dto: CreateFishCardDto) {
    const dupId = await this.findDuplicateId(dto);
    if (dupId) throw new ConflictException(`Fish card already exists (#${dupId})`);

    const entity = this.repo.create(dto);

    try {
      return await this.repo.save(entity);
    } catch (err) {
      if (isDuplicateDbError(err)) {
        const id = await this.findDuplicateId(dto);
        throw new ConflictException(`Fish card already exists${id ? ` (#${id})` : ''}`);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateFishCardDto) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    const next: DuplicateInput = {
      commonName: dto.commonName ?? found.commonName,
      scientificName: (dto as any).scientificName ?? found.scientificName,
      waterType: (dto.waterType ?? found.waterType) as WaterType,
    };

    const dupId = await this.findDuplicateId(next, id);
    if (dupId) throw new ConflictException(`Fish card already exists (#${dupId})`);

    Object.assign(found, dto);

    try {
      return await this.repo.save(found);
    } catch (err) {
      if (isDuplicateDbError(err)) {
        const id2 = await this.findDuplicateId(next, id);
        throw new ConflictException(`Fish card already exists${id2 ? ` (#${id2})` : ''}`);
      }
      throw err;
    }
  }

  async remove(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    const imageUrl = found.imageUrl;

    await this.repo.remove(found);
    await this.deleteLocalUploadIfAny(imageUrl);

    return { ok: true };
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findAll(search?: string, onlyActive = true) {
    const where = search
      ? [
          { commonName: Like(`%${search}%`), ...(onlyActive ? { isActive: true } : {}) },
          { scientificName: Like(`%${search}%`), ...(onlyActive ? { isActive: true } : {}) },
        ]
      : (onlyActive ? { isActive: true } : {});

    return this.repo.find({
      where: where as any,
      order: { commonName: 'ASC' },
    });
  }

  private async deleteLocalUploadIfAny(imageUrl: string | null | undefined) {
    if (!imageUrl) return;

    if (!imageUrl.startsWith('/uploads/fish/')) return;

    const filename = imageUrl.replace('/uploads/fish/', '').trim();

    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;

    const filePath = join(getUploadDir(), 'fish', filename);

    try {
      await fs.unlink(filePath);
    } catch {
      // ignore
    }
  }
}
