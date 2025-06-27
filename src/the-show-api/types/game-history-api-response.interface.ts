export interface GameHistoryItem {
  id: string;
  game_mode: string;
  home_full_name: string;
  away_full_name: string;
  home_display_result: string;
  away_display_result: string;
  home_runs: string;
  away_runs: string;
  home_hits: string;
  away_hits: string;
  home_errors: string;
  away_errors: string;
  display_pitcher_info: string;
  home_name: string;
  away_name: string;
  display_date: string;
}

export interface GameHistoryApiResponse {
  page: number;
  per_page: number;
  total_pages: number;
  game_history: GameHistoryItem[];
}
