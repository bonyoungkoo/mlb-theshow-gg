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
export interface AnalysisResult {
  myStats: PlayerStats;
  friendStats: PlayerStats;
  validation: {
    hitsMatch: boolean;
    runsMatch: boolean;
  };
}
