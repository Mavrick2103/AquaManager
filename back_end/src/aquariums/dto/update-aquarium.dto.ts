import { PartialType } from '@nestjs/mapped-types';
import { CreateAquariumDto } from './create-aquarium.dto';

export class UpdateAquariumDto extends PartialType(CreateAquariumDto, { skipNullProperties: false }) {}
