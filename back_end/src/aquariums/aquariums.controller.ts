import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Request, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AquariumsService } from './aquariums.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateAquariumDto } from './dto/update-aquarium.dto';
import { CreateAquariumDto } from './dto/create-aquarium.dto';

@Controller('aquariums')
@UseGuards(JwtAuthGuard)
export class AquariumsController {
  constructor(private readonly service: AquariumsService) {}

  @Get()
  findMine(@Request() req) {
    return this.service.findMine(req.user.userId);
  }

  @Get('overview')
  getOverview(@Request() req) {
    return this.service.getOverview(req.user.userId);
  }

  @Get('retention-status')
  retentionStatus(@Request() req) {
    return this.service.retentionStatus(req.user.userId);
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
    @Body() dto: UpdateAquariumDto,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(req.user.userId, id);
  }
}
