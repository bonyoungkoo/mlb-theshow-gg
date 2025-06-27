import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TheShowApiService } from './the-show-api.service';
import { TheShowApiController } from './the-show-api.controller';

@Module({
  imports: [HttpModule],
  providers: [TheShowApiService],
  controllers: [TheShowApiController],
  exports: [TheShowApiService],
})
export class TheShowApiModule {}
