import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { TheShowService } from './the-show.service';
import {
  GameHistoryApiResponse,
  GameTypeCheckRequest,
  GameTypeCheckResponse,
} from './types/game-history-api-response.interface';

@Controller('games')
export class GamesController {
  constructor(private readonly theShowService: TheShowService) {}

  @Get('history')
  async getGameHistory(
    @Query('username') username: string,
    @Query('page') page?: number,
  ): Promise<GameHistoryApiResponse> {
    return this.theShowService.fetchGameHistoryFromApi(username, page);
  }

  @Post('check-type')
  async checkGameType(
    @Body() request: GameTypeCheckRequest,
  ): Promise<GameTypeCheckResponse> {
    return this.theShowService.checkGameType(request);
  }
}
