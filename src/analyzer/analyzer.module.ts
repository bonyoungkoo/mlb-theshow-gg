import { Module } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { AnalyzerController } from './analyzer.controller';
import { TheShowApiModule } from 'src/the-show-api/the-show-api.module';

@Module({
  imports: [TheShowApiModule],
  providers: [AnalyzerService],
  controllers: [AnalyzerController],
})
export class AnalyzerModule {}
