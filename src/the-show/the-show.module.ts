import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TheShowService } from './the-show.service';
import { GamesController } from './games.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [HttpModule],
  providers: [TheShowService],
  controllers: [GamesController, UsersController],
  exports: [TheShowService],
})
export class TheShowModule {}
