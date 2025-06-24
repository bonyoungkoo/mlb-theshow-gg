import { Injectable } from '@nestjs/common';
import { AnalyzeGameDto } from './dto/analyze-game.dto';
import {
  AnalysisResult,
  AtBatEvent,
  AtBatResult,
  BatterStats,
  Ownership,
  StatLine,
  ValidationResult,
} from './types/analysis-result.interface';

@Injectable()
export class AnalyzerService {
  analyze({ line_score, game_log, box_score }: AnalyzeGameDto): AnalysisResult {
    const result = this.analyzeFromLogs(line_score, game_log, box_score);
    return result;
  }

  private analyzeFromLogs(
    line_score: any,
    game_log: any,
    box_score: any,
  ): AnalysisResult {
    const atBats = this.parseAtBats(game_log);
    const ownership = this.assignBatterOwnership(atBats);
    const myStats = this.aggregateStats(ownership.myAtBats);
    const friendStats = this.aggregateStats(ownership.friendAtBats);
    const validation = this.validateWithLineScore(
      line_score,
      myStats,
      friendStats,
    );

    return {
      myStats,
      friendStats,
      validation,
    };
  }

  private parseAtBats(gameLog: string): AtBatEvent[] {
    const lines = gameLog.split('^n^');
    const atBats: AtBatEvent[] = [];
    const runnerMap: Map<string, number> = new Map();

    // 1. ROLLERS batting 구간만 추출
    const rollerLines: string[] = [];
    let include = false;
    for (const line of lines) {
      if (line.includes('ROLLERS batting')) {
        include = true;
        rollerLines.push(line.trim());
        continue;
      }
      if (line.includes('Smackas batting')) {
        include = false;
        continue;
      }
      if (include) rollerLines.push(line.trim());
    }

    console.log('📄 ROLLERS batting log 추출:', rollerLines);

    // 2. 줄 단위로 문장 분해 및 필터링
    const rawSentences = rollerLines
      .flatMap((line) =>
        line
          .replace(/\^c\d+\^|\^e\^/g, '')
          .split('.')
          .map((p) => p.trim())
          .filter(Boolean),
      )
      .filter(
        (sentence) =>
          !/^ROLLERS batting|^Smackas batting|^.*pitching/i.test(sentence),
      );

    console.log('📌 분리된 문장 수:', rawSentences.length);
    console.log('📄 첫 5문장:', rawSentences.slice(0, 5));

    const batterActionPattern =
      /^([A-Z][a-z]+) (homered|doubled|tripled|singled|walked|grounded|flied|struck|lined|popped|hit|reached)/;

    let currentAtBat: string[] = [];
    for (const sentence of rawSentences) {
      const isNewAtBat = batterActionPattern.test(sentence);

      if (isNewAtBat) {
        if (currentAtBat.length > 0) {
          const batter = this.extractBatterName(currentAtBat[0]);
          const event = this.analyzeAtBat(
            batter,
            currentAtBat,
            new Map(runnerMap),
          );
          atBats.push(event);
          this.updateRunnersWithTracking(currentAtBat, batter, runnerMap);
          console.log('🧾 타석 분석 완료:', event);
        }

        console.log('🆕 새 타석 시작');
        console.log('👤 타자:', this.extractBatterName(sentence));
        currentAtBat = [sentence];
      } else {
        currentAtBat.push(sentence);
      }
    }

    // 마지막 타석 처리
    if (currentAtBat.length > 0) {
      console.log('🪵 마지막 타석:', currentAtBat);
      const batter = this.extractBatterName(currentAtBat[0]);
      const event = this.analyzeAtBat(batter, currentAtBat, new Map(runnerMap));
      atBats.push(event);
      this.updateRunnersWithTracking(currentAtBat, batter, runnerMap);
      console.log('⚾ 마지막 분석 결과:', event);
    }

    return atBats;
  }

  private extractBatterName(line: string): string {
    // 맨 앞 단어를 타자 이름으로 추정
    const match = line.match(/^([A-Z][a-zA-Z'-.]+)/);
    return match ? match[1] : 'UNKNOWN';
  }

  private analyzeAtBat(
    batter: string,
    atBatLog: string[],
    runnerMap: Map<string, number>,
  ): AtBatEvent {
    const result = this.inferResult(atBatLog[0]);
    const rbi = this.countRBI(atBatLog);
    const runnersBefore = new Map(runnerMap); // 복사본 저장
    const risp = this.isRISP(runnersBefore);

    return {
      batter,
      result,
      rbi,
      description: atBatLog[0],
      risp,
      runnersBefore,
    };
  }

  private updateRunnersWithTracking(
    atBatLog: string[],
    batter: string,
    runnerMap: Map<string, number>,
  ): void {
    for (const line of atBatLog) {
      const advanceMatch = line.match(
        /([A-Za-z\-'. ]+) advances to (1st|2nd|3rd|home)/,
      );
      const scoreMatch = line.match(/([A-Za-z\-'. ]+) scores/);
      const outMatch = line.match(/([A-Za-z\-'. ]+) out at (1st|2nd|3rd|home)/);

      if (advanceMatch) {
        const name = advanceMatch[1].trim();
        const base = this.baseToNumber(advanceMatch[2]);
        runnerMap.set(name, base);
      }

      if (scoreMatch) {
        const name = scoreMatch[1].trim();
        runnerMap.delete(name);
      }

      if (outMatch) {
        const name = outMatch[1].trim();
        runnerMap.delete(name);
      }
    }

    // 타자 진루 (단순화)
    const hitResult = this.inferResult(atBatLog[0]);
    if (hitResult === 'single') {
      runnerMap.set(batter, 1);
    } else if (hitResult === 'double') {
      runnerMap.set(batter, 2);
    } else if (hitResult === 'triple') {
      runnerMap.set(batter, 3);
    } else if (hitResult === 'home_run') {
      runnerMap.delete(batter); // 홈런이면 주자 제거
    } else if (hitResult === 'walk') {
      runnerMap.set(batter, 1); // 간단 처리
    }
  }

  private isRISP(runnerMap: Map<string, number>): boolean {
    for (const [, base] of runnerMap.entries()) {
      if (base === 2 || base === 3) return true;
    }
    return false;
  }

  private inferResult(description: string): AtBatResult {
    if (description.includes('homered')) return 'home_run';
    if (description.includes('tripled')) return 'triple';
    if (description.includes('doubled')) return 'double';
    if (
      description.includes('singled') ||
      description.includes('lined to') ||
      description.includes('grounded to') ||
      description.includes('reached')
    )
      return 'single';
    if (description.includes('walked')) return 'walk';
    if (description.includes('struck')) return 'strikeout';
    if (description.includes('flied') || description.includes('popped'))
      return 'out';
    return 'unknown';
  }

  private countRBI(atBatLog: string[]): number {
    return atBatLog.filter((line) => line.includes('scores')).length;
  }

  private baseToNumber(base: string): number {
    if (base === '1st') return 1;
    if (base === '2nd') return 2;
    if (base === '3rd') return 3;
    return 4; // home
  }

  private aggregateStats(atBats: AtBatEvent[]): BatterStats {
    let atBatsCount = 0;
    let hits = 0;
    let homeRuns = 0;
    let rbis = 0;
    let walks = 0;
    let strikeouts = 0;
    let totalBases = 0;

    // RISP 계산
    let rispAtBats = 0;
    let rispHits = 0;

    for (const ab of atBats) {
      const { result, risp } = ab;

      if (result === 'walk') {
        walks++;
        continue; // 타수 제외
      }

      if (result === 'strikeout') strikeouts++;
      else if (['single', 'double', 'triple', 'home_run'].includes(result))
        hits++;

      if (result === 'home_run') {
        homeRuns++;
        totalBases += 4;
      } else if (result === 'triple') {
        totalBases += 3;
      } else if (result === 'double') {
        totalBases += 2;
      } else if (result === 'single') {
        totalBases += 1;
      }

      atBatsCount++;
      rbis += ab.rbi;

      // 득점권 타율 계산
      if (risp) {
        rispAtBats++;
        if (['single', 'double', 'triple', 'home_run'].includes(result)) {
          rispHits++;
        }
      }
    }

    const average = atBatsCount ? hits / atBatsCount : 0;
    const obp =
      atBatsCount + walks ? (hits + walks) / (atBatsCount + walks) : 0;
    const slg = atBatsCount ? totalBases / atBatsCount : 0;
    const ops = obp + slg;
    const rispAverage = rispAtBats ? rispHits / rispAtBats : 0;

    return {
      atBats: atBatsCount,
      hits,
      homeRuns,
      rbis,
      walks,
      strikeouts,
      average,
      obp,
      slg,
      ops,
      rispAtBats,
      rispHits,
      rispAverage,
    };
  }

  private assignBatterOwnership(atBats: AtBatEvent[]): {
    myAtBats: AtBatEvent[];
    friendAtBats: AtBatEvent[];
  } {
    const myAtBats: AtBatEvent[] = [];
    const friendAtBats: AtBatEvent[] = [];

    let batterIndex = 0;

    for (const atBat of atBats) {
      const turn = Math.floor(batterIndex / 9); // 0부터 시작, 타순 바퀴 수
      const inTurnIndex = batterIndex % 9; // 현재 바퀴 내 순번

      // 바퀴의 시작자가 누구냐에 따라 순서 계산
      const isMyTurn =
        (turn % 2 === 0 && inTurnIndex % 2 === 0) ||
        (turn % 2 === 1 && inTurnIndex % 2 === 1);

      if (isMyTurn) {
        myAtBats.push(atBat);
      } else {
        friendAtBats.push(atBat);
      }

      batterIndex++;
    }

    return { myAtBats, friendAtBats };
  }

  validateWithLineScore(
    line_score: any,
    myStats: StatLine,
    friendStats: StatLine,
  ) {
    const expectedHits = parseInt(line_score.home_hits);
    const expectedRuns = parseInt(line_score.home_runs);

    const actualHits = myStats.hits + friendStats.hits;
    const actualRuns = myStats.rbis + friendStats.rbis;

    return {
      hitsMatch: expectedHits === actualHits,
      runsMatch: expectedRuns === actualRuns,
      expectedHits,
      actualHits,
      expectedRuns,
      actualRuns,
    };
  }
}
