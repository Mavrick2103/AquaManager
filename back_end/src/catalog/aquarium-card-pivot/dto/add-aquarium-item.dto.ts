import { IsInt, IsOptional, Min } from 'class-validator';

export class AddAquariumItemDto {
  @IsInt()
  @Min(1)
  cardId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}
