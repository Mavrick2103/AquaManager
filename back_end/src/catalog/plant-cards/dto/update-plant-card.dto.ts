import { PartialType } from '@nestjs/mapped-types';
import { CreatePlantCardDto } from './create-plant-card.dto';

export class UpdatePlantCardDto extends PartialType(CreatePlantCardDto) {}
