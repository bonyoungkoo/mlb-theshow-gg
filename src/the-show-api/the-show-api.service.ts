import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { GameApiResponse } from 'src/analyzer/types/analysis-result.interface';
import { GameHistoryApiResponse } from './types/game-history-api-response.interface';

@Injectable()
export class TheShowApiService {
  constructor(private readonly httpService: HttpService) {}

  async fetchGameLogFromApi(
    username: string,
    gameId: string,
  ): Promise<GameApiResponse> {
    const url = `https://mlb25.theshow.com/apis/game_log.json?username=${username}&id=${gameId}`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data as GameApiResponse;
  }

  async fetchGameHistoryFromApi(
    username: string,
  ): Promise<GameHistoryApiResponse> {
    const url = `https://mlb25.theshow.com/apis/game_history.json?username=${username}`;
    const response = await this.httpService.axiosRef.get(url);
    return response.data as GameHistoryApiResponse;
  }
}
