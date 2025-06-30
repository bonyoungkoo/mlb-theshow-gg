import { Module } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { AnalyzerController } from './analyzer.controller';
import { TheShowModule } from 'src/the-show/the-show.module';

@Module({
  imports: [TheShowModule],
  providers: [AnalyzerService],
  controllers: [AnalyzerController],
})
export class AnalyzerModule {}
