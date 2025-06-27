import { Controller, Get, Query } from '@nestjs/common';
import { TheShowApiService } from './the-show-api.service';
import { GameHistoryApiResponse } from './types/game-history-api-response.interface';

@Controller('games')
export class TheShowApiController {
  constructor(private readonly theShowApiService: TheShowApiService) {}

  @Get('history')
  async getGameHistory(
    @Query('username') username: string,
  ): Promise<GameHistoryApiResponse> {
    return this.theShowApiService.fetchGameHistoryFromApi(username);
  }
}
