import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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

function mustPositiveId(value: unknown, msg = 'Invalid token payload (missing userId)'): number {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) throw new UnauthorizedException(msg);
  return id;
}

@Injectable()
export class PlantCardsService {
  constructor(@InjectRepository(PlantCard) private readonly repo: Repository<PlantCard>) {}

  // =========================
  // PUBLIC (APPROVED + ACTIVE)
  // =========================
  findAllPublic(search?: string) {
    const where = search
      ? [
          { commonName: Like(`%${search}%`), isActive: true, status: 'APPROVED' as const },
          { scientificName: Like(`%${search}%`), isActive: true, status: 'APPROVED' as const },
        ]
      : { isActive: true, status: 'APPROVED' as const };

    return this.repo.find({ where: where as any, order: { commonName: 'ASC' } });
  }

  async findOnePublic(id: number) {
    const found = await this.repo.findOne({ where: { id, isActive: true, status: 'APPROVED' as const } as any });
    if (!found) throw new NotFoundException('Plant card not found');
    return found;
  }

  // =========================
  // EDITOR (ONLY OWN)
  // =========================
  findAllEditor(editorId: number, search?: string) {
    const where = search
      ? [
          { createdBy: editorId, commonName: Like(`%${search}%`) },
          { createdBy: editorId, scientificName: Like(`%${search}%`) },
        ]
      : { createdBy: editorId };

    return this.repo.find({ where: where as any, order: { createdAt: 'DESC' } });
  }

  async createEditor(dto: CreatePlantCardDto, editorIdRaw: unknown) {
    const editorId = mustPositiveId(editorIdRaw);

    const commonName = String(dto.commonName ?? '').trim();
    if (!commonName) throw new BadRequestException('commonName requis');

    const waterType = (dto.waterType ?? 'EAU_DOUCE') as any;
    const commonNameNormalized = normalizeKey(commonName);

    const scientificName = dto.scientificName ? String(dto.scientificName).trim() : null;
    const scientificNameNormalized = scientificName ? normalizeKey(scientificName) : null;

    // duplicate check
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

      // editor workflow
      createdBy: editorId,
      status: 'PENDING',
      rejectReason: null,
      approvedBy: null,
      approvedAt: null,

      // tant que pas approuvé -> pas publiable
      isActive: false,
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

  async updateEditor(id: number, dto: UpdatePlantCardDto, editorIdRaw: unknown) {
    const editorId = mustPositiveId(editorIdRaw);

    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');
    if (found.createdBy !== editorId) throw new UnauthorizedException('Not owner');

    // editor ne peut pas activer/publier ni approuver
    const sanitized: any = { ...dto };
    delete sanitized.isActive;
    delete sanitized.status;
    delete sanitized.approvedBy;
    delete sanitized.approvedAt;

    // si il modifie une fiche rejetée -> on la repasse PENDING
    if (found.status === 'REJECTED') {
      found.status = 'PENDING';
      found.rejectReason = null;
      found.isActive = false;
      found.approvedBy = null;
      found.approvedAt = null;
    }

    return this.updateCore(found, sanitized);
  }

  async removeEditor(id: number, editorIdRaw: unknown) {
    const editorId = mustPositiveId(editorIdRaw);

    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');
    if (found.createdBy !== editorId) throw new UnauthorizedException('Not owner');

    const imageUrl = found.imageUrl;
    await this.repo.remove(found);
    await this.deleteLocalUploadIfAny(imageUrl);

    return { ok: true };
  }

  // =========================
  // ADMIN (CRUD + MODERATION)
  // =========================
  findAllAdmin(search?: string) {
    const where = search
      ? [
          { commonName: Like(`%${search}%`) },
          { scientificName: Like(`%${search}%`) },
        ]
      : {};

    return this.repo.find({ where: where as any, order: { createdAt: 'DESC' } });
  }

  async createAdmin(dto: CreatePlantCardDto, adminIdRaw: unknown) {
    const adminId = mustPositiveId(adminIdRaw);

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
      select: ['id'],
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PLANT_CARD',
        message: 'Cette fiche plante existe déjà.',
        existingId: existing.id,
      });
    }

    const entity = this.repo.create({
      ...dto,
      commonName,
      scientificName,
      waterType,
      commonNameNormalized,
      scientificNameNormalized,

      // admin publish direct
      status: 'APPROVED',
      rejectReason: null,
      approvedBy: adminId,
      approvedAt: new Date(),
      createdBy: adminId,
      isActive: dto.isActive ?? true,
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

  async updateAdmin(id: number, dto: UpdatePlantCardDto, adminIdRaw: unknown) {
    mustPositiveId(adminIdRaw);

    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');

    // admin peut tout modifier (mais pas status directement via update)
    const sanitized: any = { ...dto };
    delete sanitized.status;
    delete sanitized.rejectReason;
    delete sanitized.approvedBy;
    delete sanitized.approvedAt;

    return this.updateCore(found, sanitized);
  }

  async approve(id: number, adminIdRaw: unknown) {
    const adminId = mustPositiveId(adminIdRaw);

    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');

    found.status = 'APPROVED';
    found.rejectReason = null;
    found.approvedBy = adminId;
    found.approvedAt = new Date();
    found.isActive = true;

    return this.repo.save(found);
  }

  async reject(id: number, adminIdRaw: unknown, reason: string) {
    const adminId = mustPositiveId(adminIdRaw);
    const r = String(reason ?? '').trim();
    if (!r) throw new BadRequestException('reason requis');

    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');

    found.status = 'REJECTED';
    found.rejectReason = r;
    found.approvedBy = adminId;
    found.approvedAt = new Date();
    found.isActive = false;

    return this.repo.save(found);
  }

  async removeAdmin(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plant card not found');

    const imageUrl = found.imageUrl;
    await this.repo.remove(found);
    await this.deleteLocalUploadIfAny(imageUrl);

    return { ok: true };
  }

  // =========================
  // CORE UPDATE + DUP CHECK
  // =========================
  private async updateCore(found: PlantCard, dto: UpdatePlantCardDto) {
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

    if (existing && existing.id !== found.id) {
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

  private async deleteLocalUploadIfAny(imageUrl: string | null | undefined) {
    if (!imageUrl) return;
    if (!imageUrl.startsWith('/uploads/plants/')) return;

    const filename = imageUrl.replace('/uploads/plants/', '').trim();
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;

    const filePath = join(getUploadDir(), 'plants', filename);
    try { await fs.unlink(filePath); } catch {}
  }
}
