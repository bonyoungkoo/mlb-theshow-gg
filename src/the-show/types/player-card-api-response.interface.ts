export interface Pitch {
  name: string;
  speed: number;
  control: number;
  movement: number;
}

export interface Quirks {
  name: string;
  description: string;
  img: string;
}

export interface PlayerCardItem {
  uuid: string;
  type: string;
  img: string;
  baked_img: string;
  sc_baked_img: string | null;
  name: string;
  short_description: string | null;
  rarity: string;
  team: string;
  team_short_name: string;
  ovr: number;
  series: string;
  series_texture_name: string;
  series_year: number;
  display_position: string;
  display_secondary_positions: string;
  jersey_number: string;
  age: number;
  bat_hand: string;
  throw_hand: string;
  weight: string;
  height: string;
  born: string;
  is_hitter: boolean;
  stamina?: number;
  pitching_clutch?: number;
  hits_per_bf?: number;
  k_per_bf?: number;
  bb_per_bf?: number;
  hr_per_bf?: number;
  pitch_velocity?: number;
  pitch_control?: number;
  pitch_movement?: number;
  contact_left?: number;
  contact_right?: number;
  power_left?: number;
  power_right?: number;
  plate_vision?: number;
  plate_discipline?: number;
  batting_clutch?: number;
  bunting_ability?: number;
  drag_bunting_ability?: number;
  hitting_durability?: number;
  fielding_durability?: number;
  fielding_ability?: number;
  arm_strength?: number;
  arm_accuracy?: number;
  reaction_time?: number;
  blocking?: number;
  speed?: number;
  baserunning_ability?: number;
  baserunning_aggression?: number;
  hit_rank_image?: string;
  fielding_rank_image?: string;
  pitches: Pitch[];
  quirks: Quirks[];
  is_sellable: boolean;
  has_augment: boolean;
  augment_text?: string | null;
  augment_end_date?: string | null;
  has_matchup: boolean;
  stars: unknown;
  trend: unknown;
  new_rank: number;
  has_rank_change: boolean;
  event: boolean;
  set_name: string;
  is_live_set: boolean;
  ui_anim_index: number;
  locations: string[];
}

export interface PlayerCardListing {
  listing_name: string;
  best_sell_price: number;
  best_buy_price: number;
  item: PlayerCardItem;
}

export interface PlayerCardApiResponse {
  page: number;
  per_page: number;
  total_pages: number;
  items: PlayerCardItem[];
}

export interface Query {
  uuid?: string;
}
