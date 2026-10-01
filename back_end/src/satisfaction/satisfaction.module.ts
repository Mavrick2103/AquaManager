import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Request,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../users/user.entity';
import { SatisfactionResponse, SatisfactionState } from './satisfaction.entity';
import { SatisfactionService } from './satisfaction.service';
import {
  SubmitSatisfactionDto,
  ReviewSatisfactionDto,
} from './satisfaction.dto';
@Controller('satisfaction')
@UseGuards(JwtAuthGuard)
export class SatisfactionController {
  constructor(private readonly service: SatisfactionService) {}
  @Get() status(@Request() req) {
    return this.service.status(req.user.userId);
  }
  @Post('visit') visit(@Request() req) {
    return this.service.visit(req.user.userId);
  }
  @Post('dismiss') dismiss(@Request() req) {
    return this.service.dismiss(req.user.userId);
  }
  @Post() submit(@Request() req, @Body() dto: SubmitSatisfactionDto) {
    return this.service.submit(req.user.userId, dto);
  }
}
@Controller('admin/satisfaction')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSatisfactionController {
  constructor(private readonly service: SatisfactionService) {}
  @Get() list(
    @Query()
    query: {
      segment?: string;
      source?: string;
      days?: string;
      page?: string;
      status?: string;
    },
  ) {
    return this.service.list(query);
  }
  @Patch(':id') review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewSatisfactionDto,
  ) {
    return this.service.review(id, dto.status);
  }
}
@Module({
  imports: [
    TypeOrmModule.forFeature([User, SatisfactionResponse, SatisfactionState]),
  ],
  controllers: [SatisfactionController, AdminSatisfactionController],
  providers: [SatisfactionService],
})
export class SatisfactionModule {}
