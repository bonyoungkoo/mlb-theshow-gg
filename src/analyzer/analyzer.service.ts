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
  analyze({ line_score, game_log }: AnalyzeGameDto): AnalysisResult {
    console.log('🧠 분석 시작');

    const gameLogLines = Array.isArray(game_log)
      ? game_log
      : game_log
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

    console.log('📄 줄 수:', gameLogLines.length);

    const rawAtBats = this.parseAtBats(gameLogLines);
    const runnerMap = new Map<string, number>();
    let outs = 0;

    const atBats: AtBatEvent[] = [];

    for (const raw of rawAtBats) {
      const analyzed = this.analyzeAtBat(
        raw.batter,
        raw.log,
        new Map(runnerMap),
      );
      const outsThisAB = this.updateRunnersWithTracking(
        raw.log,
        raw.batter,
        runnerMap,
      );
      outs += outsThisAB;
      const combined = { ...raw, ...analyzed };

      console.log(`📌 타석 분석됨:`);
      console.log(`👤 타자: ${combined.batter}`);
      console.log(`📄 로그:`, combined.log);
      console.log(`🏷️ 결과: ${combined.result}`);
      console.log(`🎯 RBI: ${combined.rbi}`);
      console.log(`⚾ RISP: ${combined.risp}`);
      console.log(
        `🚦 주자상태:`,
        Object.fromEntries(combined.runnersBefore || []),
      );
      console.log(`=================`);

      atBats.push(combined);
    }

    const ownership = this.assignBatterOwnership(atBats);
    const myStats = this.aggregateStats(ownership.myAtBats);
    const friendStats = this.aggregateStats(ownership.friendAtBats);
    const validation = this.validateWithLineScore(
      line_score,
      myStats,
      friendStats,
    );

    console.log(`🧾 검산 결과:`, validation);

    return {
      myStats,
      friendStats,
      validation,
    };
  }

  private parseAtBats(gameLog: string[]): AtBatEvent[] {
    const atBats: AtBatEvent[] = [];
    let inning = 1;
    let isTopInning = true;

    console.log('🎬 parseAtBats 시작');

    const batterStartRegex =
      /^([A-Za-z\s\-'.]+)\s+(popped|flied|grounded|struck|lined|hit|reached|homered|walked|doubled|tripled|sacrificed|was called)/i;

    for (let i = 0; i < gameLog.length; i++) {
      const line = gameLog[i].trim();

      if (line.includes('Game Log Legend')) {
        console.log('🛑 Game Log Legend 줄 스킵');
        break;
      }

      if (line.startsWith('Inning')) {
        const match = line.match(/Inning (\d+)/);
        if (match) {
          inning = parseInt(match[1], 10);
          isTopInning = true;
          console.log(`🕰️ 이닝 갱신: ${inning}회초`);
        }
        continue;
      }

      if (line.includes('ROLLERS batting.')) {
        isTopInning = false;
        console.log(`🎯 ROLLERS 시작 줄 발견: ${line}`);

        const sentences = line
          .replace(/^.*?batting\./, '')
          .split('.')
          .map((s) => s.trim())
          .filter(Boolean);

        let currentAtBat: AtBatEvent | null = null;

        for (const sentence of sentences) {
          const cleaned = sentence.replace(/^\^+/, '').trim();

          const match = cleaned.match(
            /^([A-Za-z\s\-'.]+)\s+(lined|grounded|flied|popped|struck|walked|hit|reached|homered|sacrificed|was called|doubled|tripled|singled|singled|bunted|hit by)/i,
          );

          if (match) {
            if (currentAtBat) {
              atBats.push(currentAtBat);
              console.log(
                `🆕 타석 추가됨: ${currentAtBat.batter} →`,
                currentAtBat.log,
              );
            }
            currentAtBat = {
              batter: match[1].trim(),
              inning,
              isTopInning,
              log: [cleaned],
            };
          } else if (sentence.startsWith('^') && currentAtBat) {
            // ^로 시작했는데 매치 안 되는 경우: 이전 타석 종료 + 새로운 타석 시작 가능성
            atBats.push(currentAtBat);
            console.log(
              `🆕 타석 추가됨(강제 분리): ${currentAtBat.batter} →`,
              currentAtBat.log,
            );
            currentAtBat = {
              batter: 'Unknown', // 이후 match에서 대체되도록 처리
              inning,
              isTopInning,
              log: [cleaned],
            };
          } else if (currentAtBat) {
            currentAtBat.log.push(cleaned);
          }
        }

        if (currentAtBat) {
          atBats.push(currentAtBat);
          console.log(
            `🆕 마지막 타석 추가됨: ${currentAtBat.batter} →`,
            currentAtBat.log,
          );
        }
      }

      if (line.includes('Smackas batting.')) {
        isTopInning = true;
        continue;
      }
    }

    console.log(`📊 총 타석 수: ${atBats.length}`);
    return atBats;
  }

  private analyzeAtBat(
    batter: string,
    atBatLog: string[],
    runnerMap: Map<string, number>,
  ): Omit<AtBatEvent, 'batter' | 'inning' | 'isTopInning' | 'log'> {
    const result = this.inferResult(atBatLog[0]);
    const rbi =
      result === 'home_run'
        ? this.countRBI(atBatLog) + 1
        : this.countRBI(atBatLog);

    const runnersBefore = new Map(runnerMap);
    const risp = this.isRISP(runnersBefore);

    return {
      result,
      rbi,
      risp,
      runnersBefore,
    };
  }

  private updateRunnersWithTracking(
    atBatLog: string[],
    batter: string,
    runnerMap: Map<string, number>,
  ): number {
    let outsThisAtBat = 0;

    const normalize = (name: string) => name.trim().replace(/\s+/g, ' ');

    for (const line of atBatLog) {
      const advanceMatch = line.match(
        /([A-Za-z\-'. ]+) advances to (1st|2nd|3rd|home)/,
      );
      const scoreMatch = line.match(/([A-Za-z\-'. ]+) scores/);
      const outMatch = line.match(/([A-Za-z\-'. ]+) out at (1st|2nd|3rd|home)/);

      if (advanceMatch) {
        const name = normalize(advanceMatch[1]);
        const base = this.baseToNumber(advanceMatch[2]);
        runnerMap.set(name, base);
      }

      if (scoreMatch) {
        const name = normalize(scoreMatch[1]);
        runnerMap.delete(name);
      }

      if (outMatch) {
        const name = normalize(outMatch[1]);
        runnerMap.delete(name);
        outsThisAtBat++;
      }

      if (
        line.includes('flied out') ||
        line.includes('popped out') ||
        line.includes('grounded out') ||
        line.includes('struck out')
      ) {
        outsThisAtBat++;
      }
    }

    const hitResult = this.inferResult(atBatLog[0]);
    if (hitResult === 'single') runnerMap.set(normalize(batter), 1);
    else if (hitResult === 'double') runnerMap.set(normalize(batter), 2);
    else if (hitResult === 'triple') runnerMap.set(normalize(batter), 3);
    else if (hitResult === 'home_run') runnerMap.delete(normalize(batter));
    else if (hitResult === 'walk') runnerMap.set(normalize(batter), 1);

    return outsThisAtBat;
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
    if (description.includes('error')) return 'error';
    if (
      description.includes('singled') ||
      description.includes('lined to') ||
      description.includes('grounded to') ||
      description.includes('reached') ||
      (description.includes('hit to') && description.includes('for a single'))
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
    return 4;
  }

  private assignBatterOwnership(atBats: AtBatEvent[]): Ownership {
    const myAtBats: AtBatEvent[] = [];
    const friendAtBats: AtBatEvent[] = [];

    let isMyTurn = true;
    let turnCount = 0;

    for (const atBat of atBats) {
      const owner = isMyTurn ? myAtBats : friendAtBats;
      owner.push(atBat);
      turnCount++;

      if (turnCount % 9 === 0) {
        isMyTurn = !isMyTurn;
      } else {
        isMyTurn = !isMyTurn;
      }
    }

    return { myAtBats, friendAtBats };
  }

  private aggregateStats(atBats: AtBatEvent[]): BatterStats {
    const stats = {
      atBats: 0,
      hits: 0,
      homeRuns: 0,
      rbis: 0,
      walks: 0,
      strikeouts: 0,
      average: 0,
      obp: 0,
      slg: 0,
      ops: 0,
      rispAtBats: 0,
      rispHits: 0,
      rispAverage: 0,
    };

    for (const ab of atBats) {
      if (ab.result !== 'walk') stats.atBats++;
      if (
        ab.result === 'single' ||
        ab.result === 'double' ||
        ab.result === 'triple' ||
        ab.result === 'home_run'
      )
        stats.hits++;
      if (ab.result === 'home_run') stats.homeRuns++;
      if (ab.result === 'walk') stats.walks++;
      if (ab.result === 'strikeout') stats.strikeouts++;
      stats.rbis += ab.rbi ?? 0;

      if (ab.risp) {
        stats.rispAtBats++;
        if (
          ab.result === 'single' ||
          ab.result === 'double' ||
          ab.result === 'triple' ||
          ab.result === 'home_run'
        ) {
          stats.rispHits++;
        }
      }
    }

    stats.average = stats.atBats ? +(stats.hits / stats.atBats).toFixed(3) : 0;
    stats.obp =
      stats.atBats + stats.walks
        ? +((stats.hits + stats.walks) / (stats.atBats + stats.walks)).toFixed(
            3,
          )
        : 0;
    stats.slg = stats.atBats
      ? +(
          atBats.reduce((acc, ab) => {
            if (ab.result === 'single') return acc + 1;
            if (ab.result === 'double') return acc + 2;
            if (ab.result === 'triple') return acc + 3;
            if (ab.result === 'home_run') return acc + 4;
            return acc;
          }, 0) / stats.atBats
        ).toFixed(3)
      : 0;
    stats.ops = +(stats.obp + stats.slg).toFixed(3);
    stats.rispAverage = stats.rispAtBats
      ? +(stats.rispHits / stats.rispAtBats).toFixed(3)
      : 0;

    return stats;
  }

  private validateWithLineScore(
    lineScore: any,
    myStats: BatterStats,
    friendStats: BatterStats,
  ): ValidationResult {
    const isRollersAway = lineScore.away_name === 'ROLLERS';

    const expectedHits = parseInt(
      isRollersAway ? lineScore.away_hits : lineScore.home_hits,
    );
    const expectedRuns = parseInt(
      isRollersAway ? lineScore.away_runs : lineScore.home_runs,
    );
    const actualHits = myStats.hits + friendStats.hits;
    const actualRuns = myStats.rbis + friendStats.rbis;

    return {
      expectedHits,
      actualHits,
      expectedRuns,
      actualRuns,
      hitsMatch: expectedHits === actualHits,
      runsMatch: expectedRuns === actualRuns,
    };
  }
}
