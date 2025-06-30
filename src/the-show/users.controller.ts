import { Controller, Get, Param } from '@nestjs/common';
import { TheShowService } from './the-show.service';
import { UserInfoApiResponse } from './types/user-info-api-response.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly theShowService: TheShowService) {}

  @Get(':username')
  async getUserInfo(
    @Param('username') username: string,
  ): Promise<UserInfoApiResponse> {
    return this.theShowService.fetchUserInfoFromApi(username);
  }
}
