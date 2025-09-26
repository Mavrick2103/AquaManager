import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { User } from '../users/user.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings) private readonly repo: Repository<Settings>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

 async ensure(userId: number) {
  let s = await this.repo.findOne({ where: { user: { id: userId } }, relations: { user: true } });
  if (!s) {
    s = this.repo.create({ user: { id: userId } as any });
    s = await this.repo.save(s);
  }
  return s;
}

get(userId: number) { 
    return this.ensure(userId); }

  async update(userId: number, dto: UpdateSettingsDto) {
    const s = await this.ensure(userId);
    Object.assign(s, dto);
    return this.repo.save(s);
  }
}
