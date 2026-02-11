// src/catalog/fish-cards/fish-card.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';

import { FishCard, normalizeText, WaterType, ModerationStatus } from './fish-card.entity';
import { CreateFishCardDto } from './dto/create-fish-card.dto';
import { UpdateFishCardDto } from './dto/update-fish-card.dto';

import { join } from 'path';
import { promises as fs } from 'fs';

function getUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

function isDuplicateDbError(err: any): boolean {
  if (err?.code === 'ER_DUP_ENTRY') return true; // MySQL
  if (err?.code === '23505') return true; // PostgreSQL
  return false;
}

// slug helper (simple + stable)
function slugify(input: string): string {
  const s =
    normalizeText(input)
      ?.replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') ?? '';
  return s;
}

type DuplicateInput = {
  commonName?: string | null;
  scientificName?: string | null;
  waterType?: WaterType | null;
};

@Injectable()
export class FishCardsService {
  constructor(@InjectRepository(FishCard) private readonly repo: Repository<FishCard>) {}

  // ---------------------
  // DUPLICATE
  // ---------------------
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

  // ---------------------
  // SLUG (unique per table)
  // ---------------------
  private async buildUniqueSlug(
    baseName: string,
    excludeId?: number,
  ): Promise<{ slug: string; slugNormalized: string }> {
    const base = slugify(baseName);
    if (!base) throw new BadRequestException('Impossible de générer un slug');

    // On garde slugNormalized = slugify(baseName) (et on suffixe si collision)
    let slug = base;
    let attempt = 0;

    while (true) {
      const exists = await this.repo.findOne({
        where: excludeId ? ({ slugNormalized: slug, id: { $ne: excludeId } } as any) : ({ slugNormalized: slug } as any),
        select: { id: true } as any,
      });

      // ⚠️ TypeORM MySQL ne supporte pas $ne : on fait simple :
      // si excludeId fourni, on vérifie et on compare l'id.
      if (!exists) return { slug, slugNormalized: slug };

      if (excludeId && exists.id === excludeId) return { slug, slugNormalized: slug };

      attempt += 1;
      slug = `${base}-${attempt}`;
      if (attempt > 200) throw new ConflictException('Impossible de trouver un slug unique');
    }
  }

  private async ensureSlugForEntity(entity: FishCard, excludeId?: number) {
    // priorité: scientificName sinon commonName
    const baseName = (entity.scientificName?.trim() || entity.commonName?.trim() || '').trim();
    if (!baseName) return;

    const slugNorm = (entity as any).slugNormalized as string | undefined | null;
    const slug = (entity as any).slug as string | undefined | null;

    // si déjà présent, on ne touche pas (sauf vide)
    if (slugNorm && slug) return;

    const built = await this.buildUniqueSlug(baseName, excludeId);
    (entity as any).slug = built.slug;
    (entity as any).slugNormalized = built.slugNormalized;
  }

  // ---------------------
  // PUBLIC
  // ---------------------
  async findAllPublic(search?: string) {
    const base = { isActive: true, status: 'APPROVED' as ModerationStatus };

    const where = search
      ? [
          { ...base, commonName: Like(`%${search}%`) },
          { ...base, scientificName: Like(`%${search}%`) },
        ]
      : base;

    return this.repo.find({
      where: where as any,
      order: { commonName: 'ASC' },
    });
  }

  async findOnePublic(id: number) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || row.status !== 'APPROVED' || !row.isActive) {
      throw new NotFoundException('Fish card not found');
    }
    return row;
  }

  // ---------------------
  // ADMIN
  // ---------------------
  findAllAdmin(search?: string) {
    const where = search
      ? [{ commonName: Like(`%${search}%`) }, { scientificName: Like(`%${search}%`) }]
      : {};

    return this.repo.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });
  }

  async createAdmin(dto: CreateFishCardDto, adminId: number) {
    const dupId = await this.findDuplicateId(dto);
    if (dupId) throw new ConflictException(`Fish card already exists (#${dupId})`);

    const entity = this.repo.create({
      ...dto,
      status: 'APPROVED',
      rejectReason: null,
      reviewedById: adminId,
      reviewedAt: new Date(),
      createdById: adminId,
      updatedById: adminId,
    });

    // ✅ slug auto si vide
    await this.ensureSlugForEntity(entity);

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

  async updateAdmin(id: number, dto: UpdateFishCardDto, adminId: number) {
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
    found.updatedById = adminId;

    // ✅ si tu changes le nom/scientifique et que tu veux regénérer slug :
    // ici je ne le regénère QUE si slug est vide (sécurisant pour SEO)
    await this.ensureSlugForEntity(found, id);

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

  async approve(id: number, adminId: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    found.status = 'APPROVED';
    found.rejectReason = null;
    found.reviewedById = adminId;
    found.reviewedAt = new Date();

    // ✅ sécurité slug avant publication
    await this.ensureSlugForEntity(found, id);

    return this.repo.save(found);
  }

  async reject(id: number, adminId: number, reason: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    found.status = 'REJECTED';
    found.rejectReason = reason?.trim() ? reason.trim() : 'Rejeté';
    found.reviewedById = adminId;
    found.reviewedAt = new Date();

    return this.repo.save(found);
  }

  async removeAdmin(id: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    const imageUrl = found.imageUrl;

    await this.repo.remove(found);
    await this.deleteLocalUploadIfAny(imageUrl);

    return { ok: true };
  }

  // ---------------------
  // EDITOR (ownership)
  // ---------------------
  async findAllEditor(editorId: number, search?: string) {
    const base = { createdById: editorId };

    const where = search
      ? [
          { ...base, commonName: Like(`%${search}%`) },
          { ...base, scientificName: Like(`%${search}%`) },
        ]
      : base;

    return this.repo.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });
  }

  async createEditor(dto: CreateFishCardDto, editorId: number) {
    const dupId = await this.findDuplicateId(dto);
    if (dupId) throw new ConflictException(`Fish card already exists (#${dupId})`);

    const entity = this.repo.create({
      ...dto,
      status: 'PENDING',
      rejectReason: null,
      createdById: editorId,
      updatedById: editorId,
      reviewedById: null,
      reviewedAt: null,
    });

    // ✅ slug auto (même en pending)
    await this.ensureSlugForEntity(entity);

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

  async updateEditor(id: number, dto: UpdateFishCardDto, editorId: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    if (found.createdById !== editorId) {
      throw new ForbiddenException('Tu ne peux modifier que tes fiches.');
    }

    const next: DuplicateInput = {
      commonName: dto.commonName ?? found.commonName,
      scientificName: (dto as any).scientificName ?? found.scientificName,
      waterType: (dto.waterType ?? found.waterType) as WaterType,
    };

    const dupId = await this.findDuplicateId(next, id);
    if (dupId) throw new ConflictException(`Fish card already exists (#${dupId})`);

    const { isActive, ...safeDto } = dto as any;
    Object.assign(found, safeDto);

    found.status = 'PENDING';
    found.rejectReason = null;
    found.updatedById = editorId;
    found.reviewedById = null;
    found.reviewedAt = null;

    // ✅ slug si vide
    await this.ensureSlugForEntity(found, id);

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

  async removeEditor(id: number, editorId: number) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Fish card not found');

    if (found.createdById !== editorId) {
      throw new ForbiddenException('Tu ne peux supprimer que tes fiches.');
    }

    const imageUrl = found.imageUrl;

    await this.repo.remove(found);
    await this.deleteLocalUploadIfAny(imageUrl);

    return { ok: true };
  }

  // ---------------------
  // SITEMAP
  // ---------------------
  async listPublishedSlugsForSitemap(): Promise<Array<{ slug: string; lastmod: string }>> {
    const rows = await this.repo.find({
      where: { isActive: true, status: 'APPROVED' as any } as any,
      select: { slug: true, updatedAt: true, createdAt: true } as any,
      order: { updatedAt: 'DESC' } as any,
    });

    return rows
      .filter((r: any) => !!r.slug)
      .map((r: any) => ({
        slug: r.slug,
        lastmod: new Date((r.updatedAt ?? r.createdAt) as any).toISOString().slice(0, 10),
      }));
  }

  // ---------------------
  // LOCAL FILE CLEANUP
  // ---------------------
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
