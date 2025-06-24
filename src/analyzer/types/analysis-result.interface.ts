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
