import { Controller, Get, Post, Body, Param, Query, Patch, Delete, Req, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // adapte le chemin à ton projet

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly service: TaskService) {}

  @Get()
  list(@Req() req: any, @Query('month') month?: string) {
    return this.service.findMine(req.user.userId, month);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.service.update(req.user.userId, Number(id), dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.userId, Number(id));
  }
}
