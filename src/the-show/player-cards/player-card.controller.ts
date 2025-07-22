import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PlayerCardService } from './player-card.service';
import { PlayerCardItem } from '../types/player-card-api-response.interface';

@Controller('player-cards')
export class PlayerCardController {
  constructor(private readonly playerCardService: PlayerCardService) {}

  @Post('sync')
  async sync() {
    await this.playerCardService.fetchAndSaveCards();
    return { message: '선수카드 동기화 완료' };
  }

  @Get()
  async findAll(@Query('page') page = '1', @Query('limit') limit = '25') {
    return this.playerCardService.findAll(Number(page), Number(limit));
  }

  @Get('search')
  async searchPlayerCards(
    @Query() filters: Record<string, string>,
    @Query('sort') sortField?: keyof PlayerCardItem,
    @Query('order') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('page') page = 1,
    @Query('limit') limit = 25,
  ) {
    return this.playerCardService.findByFilters(
      filters,
      sortField,
      sortOrder,
      +page,
      +limit,
    );
  }

  @Get(':uuid')
  async findOne(@Param('uuid') uuid: string) {
    return this.playerCardService.findOneByUuid(uuid);
  }
}
