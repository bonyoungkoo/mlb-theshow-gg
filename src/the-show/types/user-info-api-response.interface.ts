export interface PlayerSearchApiResponse {
  universal_profiles: UniversalProfile[];
}

export interface UniversalProfile {
  username: string;
  display_level: string;
  games_played: string;
  vanity: Vanity;
  most_played_modes: MostPlayedModes;
  lifetime_hitting_stats: LifetimeHittingStats[];
  lifetime_defensive_stats: LifetimeDefensiveStats[];
  online_data: OnlineData[];
}

export interface Vanity {
  nameplate_equipped: string;
  icon_equipped: string;
}

export interface MostPlayedModes {
  league_time: string;
  dd_time: string;
  playnow_time: string;
  playoff_time: string;
  franchise_time: string;
  season_time: string;
  showlive_time: string;
  rtts_time: string;
  cow_time: string;
  hrd_time: string;
}

export interface LifetimeHittingStats {
  H?: number;
  R?: number;
  HR?: number;
  SB?: number;
  Avg?: number;
  OBP?: number;
}

export interface LifetimeDefensiveStats {
  H?: number;
  ER?: number;
  K?: number;
  HR?: number;
  BB?: number;
  ERA?: number;
}

export interface OnlineData {
  year: string;
  wins: string;
  loses: string;
  hr: string;
  runs_per_game: string;
  stolen_bases: string;
  batting_average: string;
  era: string;
  k_per_9: string;
  whip: string;
}

export interface UserInfoApiResponse {
  playerInfo: PlayerSearchApiResponse;
  iconImageUrl: string | null;
}
