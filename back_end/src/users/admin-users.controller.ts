import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  // ✅ Liste + search + tri du plus récent au plus ancien
  @Get()
  list(@Query('search') search?: string) {
    return this.users.adminList(search);
  }

  // ✅ NOUVEAU : série "nouveaux users" pour le dashboard
  @Get('metrics/new-users')
  newUsersSeries(@Query('range') range?: MetricsRange) {
    const r: MetricsRange =
      range === '1d' || range === '7d' || range === '30d' || range === '365d' || range === 'all'
        ? range
        : '1d';

    return this.users.adminNewUsersSeries(r);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.users.adminGetOne(Number(id));
  }

  @Get(':id/full')
  full(@Param('id') id: string) {
    return this.users.adminGetFull(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.adminUpdate(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.adminDelete(Number(id));
  }
}
