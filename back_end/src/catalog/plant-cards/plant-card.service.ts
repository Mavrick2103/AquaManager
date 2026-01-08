import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { PlantCard } from './plant-card.entity';
import { CreatePlantCardDto } from './dto/create-plant-card.dto';
import { UpdatePlantCardDto } from './dto/update-plant-card.dto';

import { join } from 'path';
import { promises as fs } from 'fs';

function getUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

function normalizeKey(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class PlantCardsService {
  constructor(
    @InjectRepository(PlantCard) private readonly repo: Repository<PlantCard>,
  ) {}

  async create(dto: CreatePlantCardDto) {
    const commonName = String(dto.commonName ?? '').trim();
    if (!commonName) throw new BadRequestException('commonName requis');

    const waterType = (dto.waterType ?? 'EAU_DOUCE') as any;

    const commonNameNormalized = normalizeKey(commonName);
    const scientificName = dto.scientificName ? String(dto.scientificName).trim() : null;
    const scientificNameNormalized = scientificName ? normalizeKey(scientificName) : null;

    const existing = await this.repo.findOne({
      where: [
        { waterType, commonNameNormalized },
        ...(scientificNameNormalized ? [{ waterType, scientificNameNormalized }] : []),
      ] as any,
      select: ['id', 'commonName', 'waterType'],
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PLANT_CARD',
        message: 'Cette fiche plante existe déjà.',
        existingId: existing.id,
        existingCommonName: existing.commonName,
        waterType: existing.waterType,
      });
    }

    const entity = this.repo.create({
      ...dto,
      commonName,
      scientificName,
      waterType,
      commonNameNormalized,
      scientificNameNormalized,
    });

    try {
      return await this.repo.save(entity);
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException({
          code: 'DUPLICATE_PLANT_CARD',
          message: 'Cette fiche plante existe déjà.',
        });
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdatePlantCardDto) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');

    const nextWaterType = (dto.waterType ?? found.waterType) as any;

    const nextCommonName =
      dto.commonName !== undefined ? String(dto.commonName ?? '').trim() : found.commonName;
    if (!nextCommonName) throw new BadRequestException('commonName requis');

    const nextScientificName =
      dto.scientificName !== undefined
        ? (dto.scientificName ? String(dto.scientificName).trim() : null)
        : found.scientificName;

    const nextCommonNorm = normalizeKey(nextCommonName);
    const nextSciNorm = nextScientificName ? normalizeKey(nextScientificName) : null;

    const existing = await this.repo.findOne({
      where: [
        { waterType: nextWaterType, commonNameNormalized: nextCommonNorm },
        ...(nextSciNorm ? [{ waterType: nextWaterType, scientificNameNormalized: nextSciNorm }] : []),
      ] as any,
      select: ['id'],
    });

    if (existing && existing.id !== id) {
      throw new ConflictException({
        code: 'DUPLICATE_PLANT_CARD',
        message: 'Cette fiche plante existe déjà.',
        existingId: existing.id,
      });
    }

    Object.assign(found, dto);
    found.commonName = nextCommonName;
    found.scientificName = nextScientificName;
    found.waterType = nextWaterType;

    found.commonNameNormalized = nextCommonNorm;
    found.scientificNameNormalized = nextSciNorm;

    try {
      return await this.repo.save(found);
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException({
          code: 'DUPLICATE_PLANT_CARD',
          message: 'Cette fiche plante existe déjà.',
        });
      }
      throw e;
    }
  }

  async remove(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');

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
    if (!imageUrl.startsWith('/uploads/plants/')) return;

    const filename = imageUrl.replace('/uploads/plants/', '').trim();
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;

    const filePath = join(getUploadDir(), 'plants', filename);
    try { await fs.unlink(filePath); } catch {}
  }
}
