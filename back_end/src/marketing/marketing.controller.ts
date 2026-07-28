import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateMarketingPostDto,
  GenerateMarketingPostDto,
  UpdateMarketingAgentSettingsDto,
  RejectMarketingPostDto,
  UpdateMarketingPostDto,
} from './dto/marketing-post.dto';
import { MarketingService } from './marketing.service';

@Controller('admin/marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get()
  list() {
    return this.marketing.list();
  }

  @Get('instagram/status')
  instagramStatus() {
    return this.marketing.instagramStatus();
  }

  @Get('agent/settings')
  agentSettings() {
    return this.marketing.getAgentSettings();
  }

  @Patch('agent/settings')
  updateAgentSettings(@Body() dto: UpdateMarketingAgentSettingsDto) {
    return this.marketing.updateAgentSettings(dto);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateMarketingPostDto) {
    return this.marketing.create(Number(req.user.userId), dto);
  }

  @Post('generate')
  generate(@Req() req: any, @Body() dto: GenerateMarketingPostDto) {
    return this.marketing.generate(Number(req.user.userId), dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMarketingPostDto) {
    return this.marketing.update(id, dto);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.marketing.approve(id, Number(req.user.userId));
  }

  @Post(':id/publish')
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.marketing.publishToInstagram(id);
  }

  @Post(':id/generate-image')
  generateImage(@Param('id', ParseIntPipe) id: number) {
    return this.marketing.generateImage(id);
  }

  @Post(':id/revise')
  revise(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectMarketingPostDto,
  ) {
    return this.marketing.revise(id, Number(req.user.userId), dto.reason);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marketing.removeGeneratedPost(id);
  }

  @Post(':id/reject')
  reject(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectMarketingPostDto,
  ) {
    return this.marketing.reject(id, Number(req.user.userId), dto.reason);
  }
}
