import { Module } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { AnalyzerController } from './analyzer.controller';

@Module({
  providers: [AnalyzerService],
  controllers: [AnalyzerController]
})
export class AnalyzerModule {}
