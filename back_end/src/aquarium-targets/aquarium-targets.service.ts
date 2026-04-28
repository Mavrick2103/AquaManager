import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aquarium } from '../aquariums/aquariums.entity';
import { AquariumTargets, TargetMap } from './aquarium-targets.entity';
import {
  ALL_TARGET_KEYS,
  getTargetsForProfile,
  resolveDefaultProfileKey,
  TargetProfileKey,
} from './default-target-profiles';

function withAllKeys(targets: TargetMap | null | undefined): TargetMap {
  const out: TargetMap = {};
  for (const k of ALL_TARGET_KEYS) out[k] = { min: null, max: null };

  if (!targets) return out;

  for (const [key, range] of Object.entries(targets)) {
    out[key] = {
      min: range?.min ?? null,
      max: range?.max ?? null,
    };
  }

  return out;
}

@Injectable()
export class AquariumTargetsService {
  constructor(
    @InjectRepository(AquariumTargets)
    private readonly targetsRepo: Repository<AquariumTargets>,
    @InjectRepository(Aquarium)
    private readonly aquariumsRepo: Repository<Aquarium>,
  ) {}

  /**
   * Retourne les targets persistées (ou les crée avec un profil par défaut).
   */
  async getOrCreateForAquarium(aquariumId: number): Promise<AquariumTargets> {
    const existing = await this.targetsRepo.findOne({ where: { aquariumId } });
    if (existing) return existing;

    const aq = await this.aquariumsRepo.findOne({ where: { id: aquariumId } });
    if (!aq) throw new NotFoundException('Aquarium introuvable');

    const profileKey = resolveDefaultProfileKey(aq.waterType);

    const created = this.targetsRepo.create({
      aquariumId,
      profileKey: profileKey as any,
      // ✅ on stocke directement les targets (complètes) du profil
      targets: withAllKeys(getTargetsForProfile(profileKey)),
    });

    return this.targetsRepo.save(created);
  }

  /**
   * Retourne la map finale à utiliser pour l'évaluation :
   * - si targets=null -> profil par défaut
   * - sinon -> targets enregistrées
   * ✅ renvoie TOUJOURS toutes les clés
   */
  async resolveTargetMap(
    aquariumId: number,
  ): Promise<{ profileKey: string; targets: TargetMap }> {
    const t = await this.getOrCreateForAquarium(aquariumId);

    const raw =
      t.targets ?? getTargetsForProfile(t.profileKey as TargetProfileKey);

    return { profileKey: t.profileKey, targets: withAllKeys(raw) };
  }

  async updateForAquarium(
    aquariumId: number,
    input: { profileKey?: string; targets?: TargetMap },
  ): Promise<AquariumTargets> {
    const t = await this.getOrCreateForAquarium(aquariumId);

    // 1) Changement de profil (débutant)
    if (input.profileKey) {
      t.profileKey = input.profileKey as any;

      if (input.profileKey !== 'CUSTOM') {
        t.targets = withAllKeys(getTargetsForProfile(input.profileKey));
      }
    }

    // 2) Custom targets → force CUSTOM
    if (input.targets) {
      t.profileKey = 'CUSTOM';
      t.targets = withAllKeys(input.targets);
    }

    return this.targetsRepo.save(t);
  }
}
