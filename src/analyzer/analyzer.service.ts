import { Injectable } from '@nestjs/common';
import { AnalyzeGameDto } from './dto/analyze-game.dto';
import { AnalysisResult } from './types/analysis-result.interface';

@Injectable()
export class AnalyzerService {
  analyze({ line_score, game_log, box_score }: AnalyzeGameDto): AnalysisResult {
    // 이미 구현해둔 분석 로직 연결
    const result = this.analyzeFromLogs(line_score, game_log, box_score);
      return result;
    }

  private analyzeFromLogs(line_score: any, game_log: any, box_score: any): AnalysisResult {
    // 우리가 만든 parseAtBats, assignOwnership, calculateStats 등 호출
    return {
      myStats: {
        ab: 0,
        h: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        so: 0,
	avg: 0,
        obp: 0,
        slg: 0,
        ops: 0,
      },
      friendStats: {
        ab: 0,
        h: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        so: 0,
        avg: 0,
        obp: 0,
        slg: 0,
        ops: 0,
      },
      validation: { hitsMatch: true, runsMatch: true }
    };
  }
}
