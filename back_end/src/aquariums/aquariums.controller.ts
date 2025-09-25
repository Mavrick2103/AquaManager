import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AquariumsService } from './aquariums.service';
import { CreateAquariumDto } from './dto/create-aquarium.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('aquariums')
@UseGuards(JwtAuthGuard)
export class AquariumsController {
  constructor(private readonly service: AquariumsService) {}

  @Get()
  findMine(@Request() req) {
    return this.service.findMine(req.user.userId);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateAquariumDto) {
  return this.service.create(req.user.userId, dto);
}

}
