import {
  Controller, Get, Put, Post, Param, Body, Request,
  UseGuards, BadRequestException, NotFoundException
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';


@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@Request() req) {
    const user = await this.users.findById(req.user.userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    // ⬇️ user ne contient pas le champ password dans son type => on évite l'erreur TS
    const { password: _pw, ...safe } = (user as any);
    return safe;
  }

  @Put('me')
  async updateMe(@Request() req, @Body() dto: UpdateMeDto) {
    const updated = await this.users.updateProfile(req.user.userId, dto);
    if (!updated) throw new NotFoundException('Utilisateur introuvable');
    const { password: _pw, ...safe } = (updated as any);
    return safe;
  }

  @Post('me/password')
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    const ok = await this.users.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    if (!ok) throw new BadRequestException('Mot de passe actuel invalide');
    return { ok: true };
  }
}
