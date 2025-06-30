import { Controller, Post, Body } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { AnalyzeGameDto } from './dto/analyze-game.dto';

@Controller('analyze')
export class AnalyzerController {
  constructor(private readonly analyzerService: AnalyzerService) {}

  @Post()
  analyzeGame(@Body() body: AnalyzeGameDto) {
    console.log('🔍 [ANALYZE API 호출]');
    console.log('📋 요청 시간:', new Date().toISOString());
    console.log('='.repeat(50));
    return this.analyzerService.analyze(body);
  }
}
