import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PlayerCardService } from './player-card.service';
import {} from '../types/player-card-api-response.interface';
import { SearchPlayerCardsDto } from '../dto/search-player-cards.dto.ts';

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

  @Post('filter')
  async searchPlayerCards(@Body() body: SearchPlayerCardsDto) {
    const { page = 1, limit = 25, sort, order = 'desc', filters = {} } = body;

    console.log('page:\n', page);
    console.log('limit:\n', limit);
    console.log('sort:\n', sort);
    console.log('order:\n', order);
    console.log('filters:\n', JSON.stringify(filters, null, 2));

    return this.playerCardService.findByFilters(
      filters,
      sort,
      order,
      page,
      limit,
    );
  }

  @Get(':uuid')
  async findOne(@Param('uuid') uuid: string) {
    return this.playerCardService.findOneByUuid(uuid);
  }
}
