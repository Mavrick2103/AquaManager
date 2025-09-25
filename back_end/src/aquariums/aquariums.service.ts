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
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findMine(userId: number) {
    return this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: number, dto: CreateAquariumDto) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const volumeL = Math.round(
      (Number(dto.lengthCm) * Number(dto.widthCm) * Number(dto.heightCm)) / 1000
    );

    const aquarium = this.repo.create({
      name: dto.name.trim(),
      lengthCm: Number(dto.lengthCm),
      widthCm: Number(dto.widthCm),
      heightCm: Number(dto.heightCm),
      volumeL,
      waterType: dto.waterType,
      startDate: dto.startDate,
      user,
    });

    // INSERT (pas d'UPDATE)
    return this.repo.save(aquarium);
  }
}
