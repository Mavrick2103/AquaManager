import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: any) {
    return req.user; // défini par JwtStrategy.validate()
  }

  @Get('admin/ping')
  @Roles('ADMIN')
  adminPing() {
    return { ok: true, scope: 'admin' };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findById(id);
  }
}
