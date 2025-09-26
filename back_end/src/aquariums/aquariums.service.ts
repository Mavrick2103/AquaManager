import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aquarium } from './aquariums.entity';
import { CreateAquariumDto } from './dto/create-aquarium.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AquariumsService {
  constructor(
    @InjectRepository(Aquarium) private readonly repo: Repository<Aquarium>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findMine(userId: number) {
    return this.repo.find({ where: { user: { id: userId } } });
  }

  async create(userId: number, dto: CreateAquariumDto) {
    // facultatif : vérifier que l’utilisateur existe
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const volumeL = Math.round((dto.lengthCm * dto.widthCm * dto.heightCm) / 1000);

    // ⚠️ startDate -> Date (si entity attend Date)
    const startDate =
      (dto as any).startDate instanceof Date
        ? (dto as any).startDate
        : new Date(dto.startDate);

    // ✅ construire un DeepPartial<Aquarium> explicite
    const partial: Partial<Aquarium> = {
      name: dto.name.trim(),
      lengthCm: dto.lengthCm,
      widthCm: dto.widthCm,
      heightCm: dto.heightCm,
      volumeL,                      // <- propriété bien présente dans l’entity
      waterType: dto.waterType,
      startDate,                    // <- Date et plus string
      user: { id: userId } as any,  // <- DeepPartial<User> (évite User|null)
    };

    const aquarium = this.repo.create(partial);
    return this.repo.save(aquarium);
  }

  // ✅ lire un aquarium de l’utilisateur
  async findOne(userId: number, id: number) {
    const a = await this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: { user: true },
    });
    if (!a) throw new NotFoundException('Aquarium introuvable');
    return a;
  }

  // ✅ mise à jour (recalcule volume si dimensions changent)
  async update(userId: number, id: number, dto: Partial<CreateAquariumDto>) {
    const a = await this.findOne(userId, id);

    const lengthCm = dto.lengthCm ?? a.lengthCm;
    const widthCm  = dto.widthCm  ?? a.widthCm;
    const heightCm = dto.heightCm ?? a.heightCm;
    const volumeL  = Math.round((lengthCm * widthCm * heightCm) / 1000);

    Object.assign(a, {
      name: dto.name?.trim() ?? a.name,
      lengthCm, widthCm, heightCm,
      volumeL,
      waterType: dto.waterType ?? a.waterType,
      startDate: dto.startDate ?? a.startDate,
    });

    return this.repo.save(a);
  }

  // ✅ suppression
  async remove(userId: number, id: number) {
    const a = await this.findOne(userId, id);
    await this.repo.remove(a);
    return { ok: true };
  }
}
