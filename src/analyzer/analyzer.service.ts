import { Injectable } from '@nestjs/common';
import { AnalyzeGameDto } from './dto/analyze-game.dto';
import {
  AtBatEvent,
  AtBatResult,
  BatterStats,
  LineScore,
  Ownership,
  ValidationResult,
  GameMetadata,
} from './types/analysis-result.interface';
import { TheShowService } from 'src/the-show/the-show.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AnalyzerService {
  private readonly logFilePath = path.join(process.cwd(), 'log.txt');

  constructor(private readonly theShowApiService: TheShowService) {}

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    // 콘솔에도 출력
    console.log(message);

    // 파일에도 기록
    try {
      fs.appendFileSync(this.logFilePath, logMessage + '\n');
    } catch (error) {
      console.error('로그 파일 쓰기 실패:', error);
    }
  }

  async analyze(dto: AnalyzeGameDto): Promise<any> {
    const {
      username,
      // teamName,
      gameId,
      teammateUsername,
      isTeamGame = false,
      isUserHost = false,
      isSingleGame = false,
    } = dto;

    // 분석 시작 로그
    this.log('🎯 ========== 게임 분석 시작 ==========');
    this.log(`📝 사용자: ${username}`);
    this.log(`🎮 게임 ID: ${gameId}`);
    this.log(`👥 팀 게임: ${isTeamGame ? 'YES' : 'NO'}`);
    this.log(`🏠 호스트: ${isUserHost ? 'YES' : 'NO'}`);

    // CPU와의 싱글게임인 경우 분석 중단
    if (isSingleGame) {
      this.log(
        '🤖 CPU와의 싱글게임입니다. 온라인 대전게임이 아니므로 분석하지 않습니다.',
      );
      throw new Error(
        'CPU와의 싱글게임은 분석 대상이 아닙니다. 온라인 대전게임만 분석 가능합니다.',
      );
    }

    const gameType = isTeamGame ? '2:2' : '1:1';
    const hostInfo = isUserHost ? '호스트' : '팀원';
    this.log(`🎮 게임 타입: ${gameType} | 역할: ${hostInfo}`);
    this.log(`👥 팀원 닉네임: ${teammateUsername || '없음'}`);
    this.log(`🤖 싱글게임: ${isSingleGame ? 'YES' : 'NO'}`);

    const { game } = await this.theShowApiService.fetchGameLogFromApi(
      username,
      gameId,
    );
    const [lineScoreRaw, gameLogRaw] = game;

    const line_score = lineScoreRaw[1];
    const game_log = gameLogRaw[1];
    const gameLog = game_log
      .replace(/\^c\d+/g, '')
      .replace(/\^n/g, '\n')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    this.log('🧠 분석 시작');
    this.log(`📄 게임 로그: ${JSON.stringify(gameLog).substring(0, 100)}...`);
    const gameLogLines = gameLog;
    this.log(`📄 줄 수: ${gameLogLines.length}`);

    const homeTeamName = line_score.home_full_name;
    const awayTeamName = line_score.away_full_name;

    this.log(`🏟️ 홈팀 구단명: ${homeTeamName || '구단명 미확인'}`);
    this.log(`🏟️ 어웨이팀 구단명: ${awayTeamName || '구단명 미확인'}`);

    const rawAtBats = this.parseAtBats(
      gameLogLines,
      homeTeamName,
      awayTeamName,
    );
    const runnerMap = new Map<string, number>();
    let outs = 0;

    const atBats: AtBatEvent[] = [];

    // 홈팀과 어웨이팀 타석을 이닝 순서대로 합쳐서 처리
    const allRawAtBats = [...rawAtBats.home, ...rawAtBats.away].sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      return a.isTopInning === b.isTopInning ? 0 : a.isTopInning ? -1 : 1;
    });

    this.log(
      `📊 총 파싱된 타석 수: 홈팀 ${rawAtBats.home.length}개, 어웨이팀 ${rawAtBats.away.length}개, 총 ${allRawAtBats.length}개`,
    );

    for (const raw of allRawAtBats) {
      const analyzed = this.analyzeAtBat(
        raw.batter,
        raw.log,
        new Map(runnerMap),
      );

      const outsBefore = outs;
      const outsThisAB = this.updateRunnersWithTracking(
        raw.log,
        raw.batter,
        runnerMap,
      );
      outs += outsThisAB;

      if (outs >= 3) {
        outs = 0;
        runnerMap.clear();
        // console.log('🛎️ 3아웃 → 이닝 종료, 주자 초기화됨');
      }

      const combined = { ...raw, ...analyzed, outsBefore };

      this.log(`📌 타석 분석됨:`);
      this.log(`👤 타자: ${combined.batter}`);
      this.log(`📄 로그: ${JSON.stringify(combined.log)}`);
      this.log(`🏷️ 결과: ${combined.result}`);
      this.log(`🎯 RBI: ${combined.rbi}`);
      this.log(`⚾ RISP: ${combined.risp}`);
      this.log(`🕰️ 이닝: ${raw.inning} (${raw.isTopInning ? '초' : '말'})`);
      this.log(`❌ 아웃카운트: ${outsBefore}`);
      this.log(`🚦 주자상태: ${JSON.stringify(combined.runnersBefore || {})}`);
      this.log(`===========================================`);

      atBats.push(combined);
    }

    // 2단계: 홈팀과 어웨이팀 각각 분석
    const homeAtBats = atBats.filter((atBat) => !atBat.isTopInning);
    const awayAtBats = atBats.filter((atBat) => atBat.isTopInning);

    this.log(`📊 홈팀 타석 수: ${homeAtBats.length}개`);
    this.log(`📊 어웨이팀 타석 수: ${awayAtBats.length}개`);

    // 우리팀이 홈팀인지 어웨이팀인지 판단
    let isMyTeamHome = false;
    if (dto.teamSide) {
      isMyTeamHome = dto.teamSide === 'home';
    } else {
      const cleanUsername = username.replace(/\s*\^b\d+\^\s*$/, '').trim();
      const cleanHomeName = line_score.home_name
        ?.replace(/\s*\^b\d+\^\s*$/, '')
        .trim();
      isMyTeamHome = cleanHomeName === cleanUsername;
    }

    this.log(`🏠 우리팀 판단: ${isMyTeamHome ? '홈팀' : '어웨이팀'}`);

    // 홈팀 분석
    const homeAnalysis = this.analyzeTeam(
      homeAtBats,
      isMyTeamHome,
      // isTeamGame,
      // dto,
      // line_score,
      // username,
      // teammateUsername,
      // isUserHost,
    );

    // 어웨이팀 분석
    const awayAnalysis = this.analyzeTeam(
      awayAtBats,
      !isMyTeamHome,
      // isTeamGame,
      // dto,
      // line_score,
      // username,
      // teammateUsername,
      // isUserHost,
    );
    // 홈팀과 어웨이팀 검증
    const validation = this.validateWithLineScore(
      line_score,
      homeAnalysis.hostStats,
      homeAnalysis.teammateStats,
      awayAnalysis.hostStats,
      awayAnalysis.teammateStats,
    );

    const gameMetadata = this.parseGameMetadata(gameLogLines);

    this.log('🧾 검산 결과:');
    this.log(
      `🏠 홈팀 - 안타: ${validation.home.actualHits}/${validation.home.expectedHits} ${validation.home.hitsMatch ? '✅' : '❌'}, 득점: ${validation.home.actualRuns}/${validation.home.expectedRuns} ${validation.home.runsMatch ? '✅' : '❌'}`,
    );
    this.log(
      `✈️ 어웨이팀 - 안타: ${validation.away.actualHits}/${validation.away.expectedHits} ${validation.away.hitsMatch ? '✅' : '❌'}, 득점: ${validation.away.actualRuns}/${validation.away.expectedRuns} ${validation.away.runsMatch ? '✅' : '❌'}`,
    );

    // 홈팀과 원정팀 로고 가져오기
    const cleanHomeName = line_score.home_name
      ?.replace(/\s*\^b\d+\^\s*$/, '')
      .trim();
    const cleanAwayName = line_score.away_name
      ?.replace(/\s*\^b\d+\^\s*$/, '')
      .trim();

    // home_name이나 away_name이 없으면 username 사용 (우리팀 플레이어)
    const homePlayerName = cleanHomeName || username;
    const awayPlayerName = cleanAwayName || username;

    let homeTeamLogo: string | undefined;
    let awayTeamLogo: string | undefined;

    try {
      this.log('🖼️ 팀 로고 가져오는 중...');
      this.log(
        `- 홈팀: ${homePlayerName} ${cleanHomeName ? '' : '(username 사용)'}`,
      );
      this.log(
        `- 원정팀: ${awayPlayerName} ${cleanAwayName ? '' : '(username 사용)'}`,
      );

      const [homeTeamInfo, awayTeamInfo] = await Promise.all([
        this.theShowApiService.fetchUserInfoFromApi(homePlayerName),
        this.theShowApiService.fetchUserInfoFromApi(awayPlayerName),
      ]);

      homeTeamLogo = homeTeamInfo?.iconImageUrl || undefined;
      awayTeamLogo = awayTeamInfo?.iconImageUrl || undefined;

      this.log('✅ 로고 가져오기 완료');
      this.log(`- 홈팀 로고: ${homeTeamLogo ? '✅' : '❌'}`);
      this.log(`- 원정팀 로고: ${awayTeamLogo ? '✅' : '❌'}`);
    } catch (error) {
      console.error('⚠️ 팀 로고 가져오기 실패:', error);
      // 로고 가져오기 실패해도 분석은 계속 진행
    }

    // 분석 완료 로그
    this.log('✅ ========== 게임 분석 완료 ==========');
    this.log(
      `📊 홈팀 총 타석: ${homeAnalysis.hostStats.atBats + homeAnalysis.teammateStats.atBats}개`,
    );
    this.log(
      `📊 어웨이팀 총 타석: ${awayAnalysis.hostStats.atBats + awayAnalysis.teammateStats.atBats}개`,
    );
    this.log('==========================================');

    return {
      home: homeAnalysis,
      away: awayAnalysis,
      validation, // 홈팀과 어웨이팀 검증 결과
      gameMetadata, // 경기 메타데이터
      lineScore: line_score, // 경기 결과 정보
      homeTeamLogo, // 홈팀 로고 이미지 URL
      awayTeamLogo, // 원정팀 로고 이미지 URL
    };
  }

  private analyzeTeam(
    teamAtBats: AtBatEvent[],
    isMyTeam: boolean,
    // isTeamGame: boolean,
    // dto: AnalyzeGameDto,
    // lineScore: any,
    // username: string,
    // teammateUsername?: string,
    // isUserHost?: boolean,
  ) {
    const ownership = this.assignBatterOwnership(teamAtBats);

    const hostStats = this.aggregateStats(ownership.hostAtBats);
    const teammateStats = this.aggregateStats(ownership.teammateAtBats);

    this.log(
      `📊 팀 분석 완료 (${isMyTeam ? '우리팀' : '상대팀'}): 타석 ${teamAtBats.length}개`,
    );

    // 소유권 정보 로그 출력
    this.log(`🎯 소유권 분배:`);
    this.log(`👑 호스트 타석: ${ownership.hostAtBats.length}개`);
    for (const atBat of ownership.hostAtBats) {
      this.log(
        `  - ${atBat.inning}회 ${atBat.isTopInning ? '초' : '말'}: ${atBat.batter} (${atBat.result || 'unknown'})`,
      );
    }
    this.log(`👥 팀원 타석: ${ownership.teammateAtBats.length}개`);
    for (const atBat of ownership.teammateAtBats) {
      this.log(
        `  - ${atBat.inning}회 ${atBat.isTopInning ? '초' : '말'}: ${atBat.batter} (${atBat.result || 'unknown'})`,
      );
    }
    this.log(`===========================================`);

    return {
      hostStats,
      teammateStats,
      ownership,
    };
  }

  private parseAtBats(
    gameLog: string[],
    homeTeamName?: string,
    awayTeamName?: string,
  ): { home: AtBatEvent[]; away: AtBatEvent[] } {
    const atBats: { home: AtBatEvent[]; away: AtBatEvent[] } = {
      home: [],
      away: [],
    };
    let inning = 1;
    let isTopInning = true;

    for (let i = 0; i < gameLog.length; i++) {
      const line = gameLog[i].trim();

      if (line.includes('Game Log Legend')) {
        break;
      }

      if (/Inning \d+:/.test(line)) {
        const match = line.match(/Inning (\d+):/);
        if (match) {
          inning = parseInt(match[1], 10);
        }
      }

      // 현재 라인에서 batting 패턴 확인
      const battingRegex = /^\^([A-Za-z\s]+) batting\./;
      const match = line.match(battingRegex);

      if (match) {
        const teamName = match[1].trim();
        const isAwayTeam = teamName === awayTeamName;

        if (isAwayTeam) {
          this.log(`🟢 어웨이 팀(${teamName}) 공격 시작`);
          isTopInning = true;
        } else {
          this.log(`🔴 홈 팀(${homeTeamName}) 공격 시작`);
          isTopInning = false;
        }

        const sentences = line
          .replace(/^.*?batting\./, '')
          .split('.')
          .map((s) => s.trim())
          .filter(Boolean);

        let currentAtBat: AtBatEvent | null = null;

        for (const sentence of sentences) {
          const cleaned = sentence.replace(/^\^*[^A-Za-z0-9]*\s*/, '').trim();

          if (
            /pitching\.?$/i.test(cleaned) ||
            /pinch hit for/i.test(cleaned) ||
            /^Game Log Legend/i.test(cleaned) ||
            /^Runs:/i.test(cleaned)
          ) {
            continue;
          }

          // 타자 이름으로 시작하는 새로운 타석인지 확인
          const batterMatch = cleaned.match(
            /^([A-Za-z\s\-'.]+?)\s+(?:grounded out|lined out|flied out|popped out|struck out|was called out|struck|lined|grounded|flied|popped|walked|hit|reached|homered|sacrificed|was called|doubled|tripled|singled|bunted|hit by|was hit by|pinch hit|chopped)/i,
          );

          if (batterMatch) {
            // 이전 타석이 있으면 저장
            if (currentAtBat) {
              if (isAwayTeam) {
                atBats.away.push(currentAtBat);
              } else {
                atBats.home.push(currentAtBat);
              }
              this.log(
                `🆕 ${isAwayTeam ? '어웨이' : '홈'} 타석 완료: ${currentAtBat.batter} → ${JSON.stringify(currentAtBat.log)}`,
              );
            }

            // 새로운 타석 시작
            const batterName = batterMatch[1].trim();
            currentAtBat = {
              batter: batterName,
              inning,
              isTopInning,
              log: [cleaned],
            };
            this.log(
              `🆕 ${isAwayTeam ? '어웨이' : '홈'} 타석 시작: ${batterName} → ${cleaned}`,
            );
          } else if (currentAtBat) {
            // 진루, 도루, 득점 등 현재 타석에 추가
            currentAtBat.log.push(cleaned);
            this.log(
              `📝 ${isAwayTeam ? '어웨이' : '홈'} 타석 추가: ${currentAtBat.batter} ← ${cleaned}`,
            );
          }
        }

        // 마지막 타석 저장
        if (currentAtBat) {
          if (isAwayTeam) {
            atBats.away.push(currentAtBat);
          } else {
            atBats.home.push(currentAtBat);
          }
          this.log(
            `🆕 ${isAwayTeam ? '어웨이' : '홈'} 타석 완료(마지막): ${currentAtBat.batter} → ${JSON.stringify(currentAtBat.log)}`,
          );
        }
      }
    }

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

    const runnersBeforeMap = new Map(runnerMap);
    const risp = this.isRISP(runnersBeforeMap);

    return {
      result,
      rbi,
      risp,
      runnersBefore: Object.fromEntries(Array.from(runnersBeforeMap.entries())),
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
      let isOut = false;
      const advanceMatch = line.match(
        /([A-Za-z\-'. ]+) advances to (1st|2nd|3rd|home)/,
      );
      const scoreMatch = line.match(/([A-Za-z\-'. ]+) scores/);
      const outMatch = line.match(
        /([A-Za-z\-'. ]+)\s+out(?: at (1st|2nd|3rd|home))?/,
      );
      const pinchRunnerMatch = line.match(
        /([A-Za-z\-'. ]+) pinch runs for ([A-Za-z\-'. ]+)/,
      );
      const stealMatch = line.match(/([A-Za-z\-'. ]+) stole (2nd|3rd|home)/);

      if (advanceMatch) {
        const name = normalize(advanceMatch[1]);
        const base = this.baseToNumber(advanceMatch[2]);
        runnerMap.set(name, base);
        // console.log(`➡️ ${name} advances to base ${base}`);
      }

      if (scoreMatch) {
        const name = normalize(scoreMatch[1]);
        runnerMap.delete(name);
        // console.log(`🏃 ${name} scores and removed from base`);
      }

      if (outMatch) {
        const name = normalize(outMatch[1]);
        runnerMap.delete(name);
        isOut = true;
        // outsThisAtBat++;
      }

      if (pinchRunnerMatch) {
        const name = normalize(pinchRunnerMatch[1]);
        batter = name;
      }

      if (stealMatch) {
        const name = normalize(stealMatch[1]);
        const base = this.baseToNumber(stealMatch[2]);
        runnerMap.set(name, base);
      }

      if (
        line.includes('flied out') ||
        line.includes('lined out') ||
        line.includes('popped out') ||
        line.includes('grounded into a double play') ||
        line.includes('grounded out') ||
        line.includes('strikes') ||
        line.includes('was called out') ||
        line.includes('sacrificed to') ||
        line.includes('sacrifice fly') ||
        line.includes('struck out')
      ) {
        isOut = true;
      }
      if (isOut) outsThisAtBat++;
    }

    const hitResult = this.inferResult(atBatLog[0]);
    const normalizedBatter = normalize(batter);

    if (!runnerMap.has(normalizedBatter)) {
      if (hitResult === 'single') runnerMap.set(normalizedBatter, 1);
      else if (hitResult === 'double') runnerMap.set(normalizedBatter, 2);
      else if (hitResult === 'triple') runnerMap.set(normalizedBatter, 3);
      else if (hitResult === 'walk') runnerMap.set(normalizedBatter, 1);
    }

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
    if (description.includes('grounded and deflected off')) {
      if (description.includes('single')) return 'single';
      if (description.includes('doubled')) return 'double';
      if (description.includes('triple')) return 'triple';
    }
    if (description.includes('error')) return 'error';
    if (description.includes(`fielder's choice`)) return 'out';
    if (
      description.includes('singled') ||
      description.includes('lined to') ||
      description.includes('grounded to') ||
      description.includes('reached') ||
      (description.includes('hit to') && description.includes('for a single'))
    )
      return 'single';
    if (description.includes('chopped to')) return 'single';
    if (description.includes('walked')) return 'walk';
    if (description.includes('hit by a pitch')) return 'walk';
    if (description.includes('strikes')) return 'strikeout';
    if (description.includes('struck')) return 'strikeout';
    if (description.includes('grounded out')) return 'out';
    if (description.includes('grounded into a double play')) return 'out';
    if (description.includes('lined out')) return 'out';
    if (description.includes('was called out')) return 'out';
    if (description.includes('flied out')) return 'out';
    if (description.includes('popped out')) return 'out';
    if (description.includes('sacrificed to')) return 'sacrifice out';
    if (description.includes('sacrifice fly')) return 'sacrifice fly out';
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
    const hostAtBats: AtBatEvent[] = [];
    const teammateAtBats: AtBatEvent[] = [];

    let teamAtBatCount = 0;

    for (const atBat of atBats) {
      const isHostTurn = teamAtBatCount % 2;

      this.log(
        `     ${teamAtBatCount + 1}번째 타석: ${atBat.inning}회 ${atBat.isTopInning ? '초' : '말'} ${atBat.batter} -> ${isHostTurn ? '호스트' : '팀원'} (count=${teamAtBatCount}, isHostTurn=${isHostTurn})`,
      );

      if (isHostTurn) {
        hostAtBats.push(atBat);
      } else {
        teammateAtBats.push(atBat);
      }
      teamAtBatCount++;
    }

    return { hostAtBats, teammateAtBats };
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
    lineScore: LineScore,
    homeHostStats: BatterStats,
    homeTeammateStats: BatterStats,
    awayHostStats: BatterStats,
    awayTeammateStats: BatterStats,
  ): { home: ValidationResult; away: ValidationResult } {
    // 홈팀 검증
    const homeExpectedHits = parseInt(lineScore.home_hits);
    const homeExpectedRuns = parseInt(lineScore.home_runs);
    const homeActualHits = homeHostStats.hits + homeTeammateStats.hits;
    const homeActualRuns = homeHostStats.rbis + homeTeammateStats.rbis;

    const homeValidation: ValidationResult = {
      expectedHits: homeExpectedHits,
      actualHits: homeActualHits,
      expectedRuns: homeExpectedRuns,
      actualRuns: homeActualRuns,
      hitsMatch: homeExpectedHits === homeActualHits,
      runsMatch: homeExpectedRuns === homeActualRuns,
    };

    // 어웨이팀 검증
    const awayExpectedHits = parseInt(lineScore.away_hits);
    const awayExpectedRuns = parseInt(lineScore.away_runs);
    const awayActualHits = awayHostStats.hits + awayTeammateStats.hits;
    const awayActualRuns = awayHostStats.rbis + awayTeammateStats.rbis;

    const awayValidation: ValidationResult = {
      expectedHits: awayExpectedHits,
      actualHits: awayActualHits,
      expectedRuns: awayExpectedRuns,
      actualRuns: awayActualRuns,
      hitsMatch: awayExpectedHits === awayActualHits,
      runsMatch: awayExpectedRuns === awayActualRuns,
    };

    return {
      home: homeValidation,
      away: awayValidation,
    };
  }

  private parseGameMetadata(gameLog: string[]): GameMetadata {
    const metadata: GameMetadata = {};

    // 게임 로그를 하나의 문자열로 합치고 ^n으로 분리
    const fullLog = gameLog.join(' ');
    const cleanedLog = fullLog.replace(/\^c\d+/g, '').replace(/\^e\^/g, '');

    // 경기장 정보 추출
    const stadiumMatch = cleanedLog.match(
      /([A-Za-z\s]+Field|[A-Za-z\s]+Stadium|[A-Za-z\s]+Park)/,
    );
    if (stadiumMatch) {
      metadata.stadium = stadiumMatch[1].trim();
    }

    // 고도 정보 추출
    const elevationMatch = cleanedLog.match(/\((\d+\s*ft\s*elevation)\)/);
    if (elevationMatch) {
      metadata.elevation = elevationMatch[1];
    }

    // 타격/투구 난이도 추출
    const hittingDifficultyMatch = cleanedLog.match(
      /Hitting Difficulty is ([^.^]+)/,
    );
    if (hittingDifficultyMatch) {
      metadata.hittingDifficulty = hittingDifficultyMatch[1].trim();
    }

    const pitchingDifficultyMatch = cleanedLog.match(
      /Pitching Difficulty is ([^.^]+)/,
    );
    if (pitchingDifficultyMatch) {
      metadata.pitchingDifficulty = pitchingDifficultyMatch[1].trim();
    }

    // 게임 타입 추출
    const gameTypeMatch = cleanedLog.match(/(\d{4}\s*Online\s*Game)/);
    if (gameTypeMatch) {
      metadata.gameType = gameTypeMatch[1].trim();
    }

    // 관중 수 추출 (^Weather 전까지)
    const attendanceMatch = cleanedLog.match(
      /Maximum attendance:\s*([^^]+?)(?=\s*\^Weather|\s*\^No|\s*\^Scheduled|$)/,
    );
    if (attendanceMatch) {
      metadata.attendance = attendanceMatch[1].trim();
    }

    // 날씨 정보 추출 (^No Wind 또는 ^Wind 전까지)
    const weatherMatch = cleanedLog.match(
      /\^Weather:\s*([^^]+?)(?=\s*\^No Wind|\s*\^Wind|\s*\^Scheduled|$)/,
    );
    if (weatherMatch) {
      metadata.weather = weatherMatch[1].trim();
    }

    // 바람 정보 추출
    const windMatch = cleanedLog.match(/\^(No Wind|Wind:[^^]+?)(?=\s*\^|$)/);
    if (windMatch) {
      metadata.wind = windMatch[1].trim();
    }

    // 경기 시작 시간 추출 (^Game Scores 전까지)
    const firstPitchMatch = cleanedLog.match(
      /Scheduled First Pitch:\s*([^^]+?)(?=\s*\^Game|\s*\^UMPIRES|$)/,
    );
    if (firstPitchMatch) {
      metadata.scheduledFirstPitch = firstPitchMatch[1].trim();
    }

    // 심판 정보 추출
    const umpiresMatch = cleanedLog.match(
      /HP:\s*([^.]+)\.\s*1B:\s*([^.]+)\.\s*2B:\s*([^.]+)\.\s*3B:\s*([^.]+)\./,
    );
    if (umpiresMatch) {
      metadata.umpires = {
        hp: umpiresMatch[1].trim(),
        first: umpiresMatch[2].trim(),
        second: umpiresMatch[3].trim(),
        third: umpiresMatch[4].trim(),
      };
    }

    this.log(`🏟️ 경기 메타데이터 파싱 완료: ${JSON.stringify(metadata)}`);

    return metadata;
  }
}
