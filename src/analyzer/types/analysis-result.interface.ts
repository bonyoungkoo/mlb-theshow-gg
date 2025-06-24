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
  | 'unknown';

export interface AtBatEvent {
  batter: string;
  result: AtBatResult;
  rbi: number;
  description: string;
  runnersBefore: Map<string, number>; // 이름 기준 루상 상태
  risp: boolean; // 득점권 여부
}

export interface Ownership {
  my: AtBatEvent[];
  friend: AtBatEvent[];
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
