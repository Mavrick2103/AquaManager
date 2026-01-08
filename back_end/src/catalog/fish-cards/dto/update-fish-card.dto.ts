import { PartialType } from '@nestjs/mapped-types';
import { CreateFishCardDto } from './create-fish-card.dto';

export class UpdateFishCardDto extends PartialType(CreateFishCardDto) {}
