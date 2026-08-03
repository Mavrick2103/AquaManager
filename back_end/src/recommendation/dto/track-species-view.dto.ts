import { IsIn, IsInt, Min } from 'class-validator';

export class TrackSpeciesViewDto {
  @IsIn(['fish', 'plant'])
  kind!: 'fish' | 'plant';

  @IsInt()
  @Min(1)
  resourceId!: number;
}
