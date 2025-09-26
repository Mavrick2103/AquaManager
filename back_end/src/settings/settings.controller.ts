import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@Request() req) {
    return this.service.get(req.user.userId);
  }

  @Put()
  update(@Request() req, @Body() dto: UpdateSettingsDto) {
    return this.service.update(req.user.userId, dto);
  }
}
