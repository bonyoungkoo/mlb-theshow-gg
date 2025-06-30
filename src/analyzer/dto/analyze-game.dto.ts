export class AnalyzeGameDto {
  username: string; // 플레이어 ID (API 호출용)
  teamName: string; // 구단명 (예: ROLLERS - home_full_name 또는 away_full_name)
  gameId: string;
  isTeamGame?: boolean; // 2:2 게임 여부
  isUserHost?: boolean; // 사용자가 호스트인지 여부
  isSingleGame?: boolean; // CPU와의 싱글게임 여부
  teammateUsername?: string; // 팀원 닉네임 (게임 로그에서 팀 구분용)
  teamSide?: 'home' | 'away'; // 홈팀인지 어웨이팀인지 명시적으로 지정 (폴백용)
}
