import { Controller, Post, Body } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { AnalyzeGameDto } from './dto/analyze-game.dto';

@Controller('analyze')
export class AnalyzerController {
  constructor(private readonly analyzerService: AnalyzerService) {}

  @Post()
  analyzeGame(@Body() body: AnalyzeGameDto) {
    console.log('body', body);
    return this.analyzerService.analyze(body);
  }
}
