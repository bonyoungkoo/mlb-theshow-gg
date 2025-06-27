export interface PlayerStats {
  ab: number;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface BatterStats {
  atBats: number;
  hits: number;
  homeRuns: number;
  rbis: number;
  walks: number;
  strikeouts: number;
  average: number;
  obp: number;
  slg: number;
  ops: number;

  // 추가
  rispAtBats: number;
  rispHits: number;
  rispAverage: number;
}

export interface AnalysisResult {
  myStats: BatterStats;
  friendStats: BatterStats;
  validation: ValidationResult;
}

export type AtBatResult =
  | 'single'
  | 'double'
  | 'triple'
  | 'home_run'
  | 'walk'
  | 'strikeout'
  | 'out'
  | 'sacrifice out'
  | 'sacrifice fly out'
  | 'error'
  | 'unknown';

export interface AtBatEvent {
  batter: string;
  result?: AtBatResult;
  rbi?: number;
  description?: string;
  risp?: boolean;
  runnersBefore?: Map<string, number>;
  inning: number;
  isTopInning: boolean;
  log: string[];
}

export interface Ownership {
  myAtBats: AtBatEvent[];
  friendAtBats: AtBatEvent[];
}

export interface ValidationResult {
  hitsMatch: boolean;
  runsMatch: boolean;
  expectedHits: number;
  actualHits: number;
  expectedRuns: number;
  actualRuns: number;
}

export interface ValidationResult {
  hitsMatch: boolean;
  runsMatch: boolean;
  expectedHits: number;
  actualHits: number;
  expectedRuns: number;
  actualRuns: number;
}
export interface StatLine {
  atBats: number;
  hits: number;
  homeRuns: number;
  rbis: number;
  walks: number;
  strikeouts: number;
  average: number;
  obp: number;
  slg: number;
  ops: number;
  rispAtBats: number;
  rispHits: number;
  rispAverage: number;
}

export interface LineScore {
  inning: string;
  home_full_name: string;
  away_full_name: string;
  away_hits: string;
  away_runs: string;
  home_hits: string;
  home_runs: string;
}

export interface GameApiResponse {
  game: [LineScoreTuple, GameLogTuple, BoxScoreTuple];
}

export type LineScoreTuple = ['line_score', LineScore];
export type GameLogTuple = ['game_log', string];
export type BoxScoreTuple = ['box_score', BoxScore[]];

export interface LineScore {
  home_name: string;
  away_name: string;
  home_runs: string;
  away_runs: string;
  home_hits: string;
  away_hits: string;
  game_mode: string;
  game_uuid: string;
  innings: string;
  home_display_result: string;
  away_display_result: string;
  // 필요시 다른 필드도 추가
}

export interface BoxScore {
  team_id: string;
  team_name: string;
  r: string; // CSV 형식 (e.g., "2,0,1")
  h: string;
  e: string;
  last_inning: string;

  [teamId: string]: TeamStats | string; // key가 team_id일 경우 해당 팀의 상세 통계
}

export interface TeamStats {
  batting_totals: {
    ab: string;
    r: string;
    h: string;
    rbi: string;
    bb: string;
    so: string;
  };
  batting_stats: PlayerStat[];
  pitching_totals: {
    ip: string;
    h: string;
    r: string;
    er: string;
    bb: string;
    so: string;
  };
  pitching_stats: any[]; // 필요 시 상세 타입 정의
}

export interface PlayerStat {
  player_name: string;
  ab: string;
  r: string;
  h: string;
  rbi: string;
  bb: string;
  so: string;
  avg: string;
  hr: string;
  doubles: string;
  triples: string;
  sb: string;
  cs: string;
  pos: string;
  // 생략된 필드도 필요에 따라 추가 가능
}
