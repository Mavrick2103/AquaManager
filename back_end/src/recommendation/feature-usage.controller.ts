import { Body, Controller, Headers, Post } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { PublicAnalyticsRateLimit } from '../common/throttling/rate-limit.decorator';
import { TrackSpeciesViewDto } from './dto/track-species-view.dto';
import { RecommendationService } from './recommendation.service';

@Controller('feature-usage')
export class FeatureUsageController {
  constructor(private readonly service: RecommendationService) {}

  @Public()
  @PublicAnalyticsRateLimit()
  @Post('species-view')
  trackSpeciesView(
    @Body() body: TrackSpeciesViewDto,
    @Headers('x-view-key') visitorKey?: string,
  ) {
    return this.service.trackSpeciesView(body.kind, body.resourceId, visitorKey);
  }
}
