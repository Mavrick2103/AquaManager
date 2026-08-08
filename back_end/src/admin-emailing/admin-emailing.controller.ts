import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminEmailingService } from './admin-emailing.service';
import { AdminEmailAudienceDto, SendAdminEmailDto } from './dto/admin-email.dto';

@Controller('admin/emailing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminEmailingController {
  constructor(private readonly emailing: AdminEmailingService) {}

  @Post('preview')
  preview(@Body() dto: AdminEmailAudienceDto) { return this.emailing.preview(dto); }

  @Post('send')
  send(@Body() dto: SendAdminEmailDto) { return this.emailing.send(dto); }
}
