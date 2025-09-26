import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Request, UseGuards, ParseIntPipe
} from '@nestjs/common';
import { AquariumsService } from './aquariums.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAquariumDto } from './dto/create-aquarium.dto';

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

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(req.user.userId, id);
  }

  @Put(':id')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateAquariumDto>,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(req.user.userId, id);
  }
}
