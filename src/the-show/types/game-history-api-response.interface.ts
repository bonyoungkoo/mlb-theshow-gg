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
  teamName?: string; // 플레이어의 팀 이름
  isTeamGame?: boolean; // 2:2 게임 여부
  isUserHost?: boolean; // 사용자가 호스트인지 여부
  isSingleGame?: boolean; // CPU와의 싱글게임 여부
  isTeamGameChecking?: boolean; // 2:2 게임 여부 확인 중
}

export interface GameHistoryApiResponse {
  page: number;
  per_page: number;
  total_pages: number;
  game_history: GameHistoryItem[];
}

// 게임 타입 체크 관련 인터페이스 (단일 게임 처리)
export interface GameTypeCheckRequest {
  gameId: string; // 단일 게임 체크
  teammateUsername: string;
}

export interface GameTypeCheckResponse {
  gameId: string;
  isTeamGame: boolean;
}
