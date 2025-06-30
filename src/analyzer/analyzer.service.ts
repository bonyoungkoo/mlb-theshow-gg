import { Injectable } from '@nestjs/common';
import { AnalyzeGameDto } from './dto/analyze-game.dto';
import {
  AnalysisResult,
  AtBatEvent,
  AtBatResult,
  BatterStats,
  LineScore,
  Ownership,
  ValidationResult,
  GameMetadata,
} from './types/analysis-result.interface';
import { TheShowService } from 'src/the-show/the-show.service';

@Injectable()
export class AnalyzerService {
  constructor(private readonly theShowApiService: TheShowService) {}

  async analyze(dto: AnalyzeGameDto): Promise<AnalysisResult> {
    const {
      username,
      teamName,
      gameId,
      teammateUsername,
      isTeamGame = false,
      isUserHost = false,
      isSingleGame = false,
    } = dto;

    // CPU와의 싱글게임인 경우 분석 중단
    if (isSingleGame) {
      console.log(
        '🤖 CPU와의 싱글게임입니다. 온라인 대전게임이 아니므로 분석하지 않습니다.',
      );
      throw new Error(
        'CPU와의 싱글게임은 분석 대상이 아닙니다. 온라인 대전게임만 분석 가능합니다.',
      );
    }

    const gameType = isTeamGame ? '2:2' : '1:1';
    const hostInfo = isUserHost ? '호스트' : '팀원';
    console.log(`🎮 게임 타입: ${gameType} | 역할: ${hostInfo}`);
    console.log(`👥 팀원 닉네임: ${teammateUsername || '없음'}`);
    console.log(`🤖 싱글게임: ${isSingleGame ? 'YES' : 'NO'}`);

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

    console.log('🧠 분석 시작', gameLog);
    const gameLogLines = gameLog;
    console.log('📄 줄 수:', gameLogLines.length);

    // 내 팀 구단명은 프론트엔드에서 전달받음
    const myTeamName = teamName;

    // 상대팀 구단명도 결정
    let opponentTeamName = '';
    if (myTeamName) {
      opponentTeamName =
        myTeamName === line_score.home_full_name
          ? line_score.away_full_name
          : line_score.home_full_name;
    }

    console.log(`🏟️ 내 팀 구단명: ${myTeamName || '구단명 미확인'}`);
    console.log(`🏟️ 상대팀 구단명: ${opponentTeamName || '구단명 미확인'}`);

    if (!myTeamName) {
      throw new Error(
        '플레이어의 구단명을 찾을 수 없습니다. 게임 데이터를 확인해주세요.',
      );
    }

    const rawAtBats = this.parseAtBats(
      gameLogLines,
      myTeamName,
      opponentTeamName,
    );
    const runnerMap = new Map<string, number>();
    let outs = 0;

    const atBats: AtBatEvent[] = [];

    for (const raw of rawAtBats) {
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

      console.log(`📌 타석 분석됨:`);
      console.log(`👤 타자: ${combined.batter}`);
      console.log(`📄 로그:`, combined.log);
      console.log(`🏷️ 결과: ${combined.result}`);
      console.log(`🎯 RBI: ${combined.rbi}`);
      console.log(`⚾ RISP: ${combined.risp}`);
      console.log(`🕰️ 이닝: ${raw.inning} (${raw.isTopInning ? '초' : '말'})`);
      console.log(`❌ 아웃카운트: ${outsBefore}`);
      console.log(`🚦 주자상태:`, combined.runnersBefore || {});
      console.log(`===========================================`);

      atBats.push(combined);
    }

    // 2단계: 게임 타입에 따른 소유권 배정
    let ownership: Ownership;
    if (isTeamGame) {
      // 2:2 게임 - 새로운 로직 사용
      ownership = this.assignBatterOwnership(
        atBats,
        dto.teamSide,
        line_score,
        username,
        teammateUsername,
        isUserHost,
      );
    } else {
      // 1:1 게임 - 기존 방식 사용
      ownership = this.assignBatterOwnership(atBats);
      // console.log(`🔄 1:1 게임으로 분석됨 - 기존 방식 사용`);
    }

    // 각 타석에 소유권 정보 추가
    const atBatsWithOwnership = atBats.map((atBat) => ({
      ...atBat,
      owner: ownership.myAtBats.includes(atBat)
        ? ('my' as const)
        : ('friend' as const),
    }));

    const myStats = this.aggregateStats(ownership.myAtBats);
    const friendStats = this.aggregateStats(ownership.friendAtBats);
    // teammateUsername을 이용해 감지된 팀 정보를 validation에도 사용
    let detectedTeamSide = dto.teamSide;
    if (teammateUsername && line_score && username) {
      const cleanUsername = username.replace(/\s*\^b\d+\^\s*$/, '').trim();
      const cleanTeammateUsername = teammateUsername
        .replace(/\s*\^b\d+\^\s*$/, '')
        .trim();
      const cleanHomeName = line_score.home_name
        ?.replace(/\s*\^b\d+\^\s*$/, '')
        .trim();
      const cleanAwayName = line_score.away_name
        ?.replace(/\s*\^b\d+\^\s*$/, '')
        .trim();

      const isUsernameHome = cleanHomeName === cleanUsername;
      const isTeammateHome = cleanHomeName === cleanTeammateUsername;
      const isUsernameAway = cleanAwayName === cleanUsername;
      const isTeammateAway = cleanAwayName === cleanTeammateUsername;

      if (isUsernameHome && isTeammateHome) {
        detectedTeamSide = 'home';
      } else if (isUsernameAway && isTeammateAway) {
        detectedTeamSide = 'away';
      }
    }

    const validation = this.validateWithLineScore(
      line_score,
      myStats,
      friendStats,
      detectedTeamSide,
      myTeamName,
    );

    const gameMetadata = this.parseGameMetadata(gameLogLines);

    // console.log(`🧾 검산 결과:`, validation);

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
      console.log('🖼️ 팀 로고 가져오는 중...');
      console.log(
        '- 홈팀:',
        homePlayerName,
        cleanHomeName ? '' : '(username 사용)',
      );
      console.log(
        '- 원정팀:',
        awayPlayerName,
        cleanAwayName ? '' : '(username 사용)',
      );

      const [homeTeamInfo, awayTeamInfo] = await Promise.all([
        this.theShowApiService.fetchUserInfoFromApi(homePlayerName),
        this.theShowApiService.fetchUserInfoFromApi(awayPlayerName),
      ]);

      homeTeamLogo = homeTeamInfo?.iconImageUrl || undefined;
      awayTeamLogo = awayTeamInfo?.iconImageUrl || undefined;

      console.log('✅ 로고 가져오기 완료');
      console.log('- 홈팀 로고:', homeTeamLogo ? '✅' : '❌');
      console.log('- 원정팀 로고:', awayTeamLogo ? '✅' : '❌');
    } catch (error) {
      console.error('⚠️ 팀 로고 가져오기 실패:', error);
      // 로고 가져오기 실패해도 분석은 계속 진행
    }

    return {
      myStats,
      friendStats,
      validation,
      atBatDetails: atBatsWithOwnership, // 모든 타석별 상세 데이터
      ownership, // 소유권별로 분리된 데이터
      gameMetadata, // 경기 메타데이터
      lineScore: line_score, // 경기 결과 정보
      homeTeamLogo, // 홈팀 로고 이미지 URL
      awayTeamLogo, // 원정팀 로고 이미지 URL
    };
  }

  private parseAtBats(
    gameLog: string[],
    myTeamName?: string,
    opponentTeamName?: string,
  ): AtBatEvent[] {
    const atBats: AtBatEvent[] = [];
    let inning = 1;
    let isTopInning = true;

    // console.log('�� parseAtBats 시작');

    for (let i = 0; i < gameLog.length; i++) {
      const line = gameLog[i].trim();

      if (line.includes('Game Log Legend')) {
        // console.log('🛑 Game Log Legend 줄 스킵');
        break;
      }

      if (/Inning \d+:/.test(line)) {
        const match = line.match(/Inning (\d+):/);
        if (match) {
          inning = parseInt(match[1], 10);
          // console.log(`🕰️ 이닝 갱신: ${inning}회`);
        }
      }

      // 내 팀 공격 시작
      const teamBattingPattern = `${myTeamName} batting.`;
      if (line.includes(teamBattingPattern)) {
        isTopInning = false;
        // console.log(`🎯 ${myTeamName} 공격 시작: ${line}`);

        const sentences = line
          .replace(/^.*?batting\./, '')
          .split('.')
          .map((s) => s.trim())
          .filter(Boolean);

        let currentAtBat: AtBatEvent | null = null;

        for (const sentence of sentences) {
          const cleaned = sentence
            .replace(/^\^*[^A-Za-z0-9]*\s*/, '') // ^, *, 공백류 모두 제거
            .trim();

          if (
            /pitching\.?$/i.test(cleaned) || // .으로 끝나거나 안 끝나거나
            /pinch hit for/i.test(cleaned) ||
            /^Game Log Legend/i.test(cleaned)
          ) {
            // console.log(`🚫 타석 아님(제외): ${cleaned}`);
            continue;
          }

          const match = cleaned.match(
            /^([A-Za-z\s\-'.]+?)\s+(?:grounded out|lined out|flied out|popped out|struck out|was called out|struck|lined|grounded|flied|popped|walked|hit|reached|homered|sacrificed|was called|doubled|tripled|singled|bunted|hit by|was hit by|pinch hit)/i,
          );

          if (match) {
            if (currentAtBat) {
              atBats.push(currentAtBat);
              // console.log(
              //   `🆕 타석 추가됨: ${currentAtBat.batter} →`,
              //   currentAtBat.log,
              // );
            }
            currentAtBat = {
              batter: match[1].trim(),
              inning,
              isTopInning,
              log: [cleaned],
            };
          } else if (sentence.startsWith('^') && currentAtBat) {
            if (/^[A-Za-z\s\-'.]+ stole (2nd|3rd|home)/i.test(cleaned)) {
              currentAtBat.log.push(cleaned);
              continue;
            }

            // ^로 시작했는데 매치 안 되는 경우: 이전 타석 종료 + 새로운 타석 시작 가능성
            atBats.push(currentAtBat);
            // console.log(
            //   `🆕 타석 추가됨(강제 분리): ${currentAtBat.batter} →`,
            //   currentAtBat.log,
            // );

            const forcedMatch = cleaned.match(
              /^\*?\s*\^*\s*([A-Za-z\s\-'.]+)\s+(lined|grounded|flied|popped|struck|walked|hit|reached|homered|sacrificed|was called|doubled|tripled|singled|bunted|hit by)/i,
            );
            const forcedName = forcedMatch ? forcedMatch[1].trim() : 'Unknown';

            currentAtBat = {
              batter: forcedName,
              inning,
              isTopInning,
              log: [cleaned],
            };
          } else if (currentAtBat) {
            currentAtBat.log.push(cleaned);
          }
        }

        if (
          currentAtBat &&
          currentAtBat.log.every((line) => line.trim() === '')
        ) {
          // console.log('🗑️ 마지막 빈 타석 제거');
        } else if (currentAtBat) {
          atBats.push(currentAtBat);
          // console.log(
          //   `🆕 마지막 타석 추가됨: ${currentAtBat.batter} →`,
          //   currentAtBat.log,
          // );
        }
      }

      // 상대팀 공격 시작
      const opponentBattingPattern = `${opponentTeamName} batting.`;
      if (line.includes(opponentBattingPattern)) {
        isTopInning = true;
        // console.log(`🎯 상대팀 ${opponentTeamName} 공격 시작: ${line}`);
        continue;
      }
    }

    // console.log(`📊 총 타석 수: ${atBats.length}`);
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

  private assignBatterOwnership(
    atBats: AtBatEvent[],
    teamSide?: 'home' | 'away',
    lineScore?: LineScore,
    username?: string,
    teammateUsername?: string,
    isUserHostParam?: boolean,
  ): Ownership {
    const myAtBats: AtBatEvent[] = [];
    const friendAtBats: AtBatEvent[] = [];

    // teammateUsername을 이용해 팀 구분 시도
    let determinedTeamSide = teamSide;
    if (teammateUsername && lineScore && username) {
      const cleanUsername = username.replace(/\s*\^b\d+\^\s*$/, '').trim();
      const cleanTeammateUsername = teammateUsername
        .replace(/\s*\^b\d+\^\s*$/, '')
        .trim();
      const cleanHomeName = lineScore.home_name
        ?.replace(/\s*\^b\d+\^\s*$/, '')
        .trim();
      const cleanAwayName = lineScore.away_name
        ?.replace(/\s*\^b\d+\^\s*$/, '')
        .trim();

      console.log(`🔍 팀 자동 감지 시도:`);
      console.log(
        `   사용자: "${cleanUsername}" | 팀원: "${cleanTeammateUsername}"`,
      );
      console.log(`   홈팀: "${cleanHomeName}" | 어웨이팀: "${cleanAwayName}"`);

      // 내 닉네임과 팀원 닉네임이 같은 팀인지 확인
      const isUsernameHome = cleanHomeName === cleanUsername;
      const isTeammateHome = cleanHomeName === cleanTeammateUsername;
      const isUsernameAway = cleanAwayName === cleanUsername;
      const isTeammateAway = cleanAwayName === cleanTeammateUsername;

      if (isUsernameHome && isTeammateHome) {
        // 둘 다 홈팀 - 정상적인 2:2 게임
        determinedTeamSide = 'home';
        console.log(
          `🏠 자동 감지: 홈팀 (${cleanUsername}, ${cleanTeammateUsername})`,
        );
      } else if (isUsernameAway && isTeammateAway) {
        // 둘 다 어웨이팀 - 정상적인 2:2 게임
        determinedTeamSide = 'away';
        console.log(
          `✈️ 자동 감지: 어웨이팀 (${cleanUsername}, ${cleanTeammateUsername})`,
        );
      } else if (
        (isUsernameHome && isTeammateAway) ||
        (isUsernameAway && isTeammateHome)
      ) {
        // 서로 다른 팀에 있음 - 이상함
        console.log(
          '⚠️ 사용자와 팀원이 서로 다른 팀에 있습니다. 1:1 게임이거나 팀원 정보가 잘못되었을 수 있습니다.',
        );
      } else {
        console.log(
          '⚠️ 닉네임으로 팀을 자동 감지할 수 없습니다. 기존 방식 사용.',
        );
      }
    }

    // determinedTeamSide가 여전히 없으면 기존 방식으로 폴백
    if (!determinedTeamSide || !lineScore) {
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

    // determinedTeamSide 정보를 기반으로 정확한 ownership 할당
    const myTeamName =
      determinedTeamSide === 'home'
        ? lineScore.home_full_name
        : lineScore.away_full_name;

    // 호스트 정보 사용 (이미 analyze에서 판단됨)
    const isUserHost = isUserHostParam ?? false;
    if (isUserHost) {
      console.log(`🎮 호스트: ${username} (첫 타석 소유권)`);
    } else if (teammateUsername) {
      console.log(`🎮 호스트: ${teammateUsername} (첫 타석 소유권)`);
    }

    // 호스트 정보를 기반으로 타석 배정
    const isMyTeamHome = determinedTeamSide === 'home';
    let teamAtBatCount = 0; // 우리 팀 타석 카운터

    for (const atBat of atBats) {
      // 초회(top)는 어웨이팀, 말회(bottom)는 홈팀이 공격
      const isMyTeamTurn = isMyTeamHome
        ? !atBat.isTopInning
        : atBat.isTopInning;

      if (isMyTeamTurn) {
        // 우리 팀 턴일 때: 호스트가 먼저, 팀원이 나중에
        const isMyTurn = isUserHost
          ? teamAtBatCount % 2 === 0
          : teamAtBatCount % 2 === 1;

        if (isMyTurn) {
          myAtBats.push(atBat);
        } else {
          friendAtBats.push(atBat);
        }
        teamAtBatCount++;
      }
      // 상대 팀 턴일 때는 아무것도 하지 않음 (우리 팀 타석이 아니므로)
    }

    console.log(`🏠 내 팀: ${myTeamName} (${determinedTeamSide})`);
    console.log(
      `📊 내 타석: ${myAtBats.length}개, 팀원 타석: ${friendAtBats.length}개`,
    );

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
    lineScore: LineScore,
    myStats: BatterStats,
    friendStats: BatterStats,
    teamSide?: 'home' | 'away',
    myTeamName?: string,
  ): ValidationResult {
    // teamSide가 제공된 경우 이를 기반으로 검증, 그렇지 않으면 구단명으로 판단
    let isMyTeamAway: boolean;
    if (teamSide) {
      isMyTeamAway = teamSide === 'away';
    } else if (myTeamName) {
      // 구단명으로 판단
      isMyTeamAway = lineScore.away_full_name === myTeamName;
    } else {
      throw new Error(
        '팀 정보를 확인할 수 없습니다. teamSide 또는 myTeamName이 필요합니다.',
      );
    }

    const expectedHits = parseInt(
      isMyTeamAway ? lineScore.away_hits : lineScore.home_hits,
    );
    const expectedRuns = parseInt(
      isMyTeamAway ? lineScore.away_runs : lineScore.home_runs,
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

    console.log('🏟️ 경기 메타데이터 파싱 완료:', metadata);

    return metadata;
  }
}
