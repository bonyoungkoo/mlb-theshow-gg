import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TheShowService } from './the-show.service';
import { GamesController } from './games.controller';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PlayerCard,
  PlayerCardSchema,
} from './player-cards/player-card.schema';
import { PlayerCardService } from './player-cards/player-card.service';
import { PlayerCardController } from './player-cards/player-card.controller';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: PlayerCard.name, schema: PlayerCardSchema },
    ]),
  ],
  providers: [TheShowService, PlayerCardService],
  controllers: [GamesController, UsersController, PlayerCardController],
  exports: [TheShowService],
})
export class TheShowModule {}
