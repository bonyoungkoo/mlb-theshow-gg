import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PlayerCardItem,
  PlayerCardSearchFilters,
} from '../types/player-card-api-response.interface';

export class SearchPlayerCardsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 25;

  @IsOptional()
  @IsString()
  sort?: keyof PlayerCardItem;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsObject()
  filters?: PlayerCardSearchFilters;
}
