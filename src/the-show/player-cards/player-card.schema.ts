import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlayerCardDocument = PlayerCard & Document;

@Schema({ timestamps: true })
export class PlayerCard {
  @Prop({ required: true, unique: true })
  uuid: string;

  @Prop() type: string;
  @Prop() img: string;
  @Prop() baked_img: string;
  @Prop({ type: String }) sc_baked_img: string | null;

  @Prop() name: string;
  @Prop({ type: String }) short_description: string | null;
  @Prop() rarity: string;
  @Prop() team: string;
  @Prop() team_short_name: string;
  @Prop() ovr: number;
  @Prop() series: string;
  @Prop() series_texture_name: string;
  @Prop() series_year: number;
  @Prop() display_position: string;
  @Prop() display_secondary_positions: string;
  @Prop() jersey_number: string;
  @Prop() age: number;
  @Prop() bat_hand: string;
  @Prop() throw_hand: string;
  @Prop() weight: string;
  @Prop() height: string;
  @Prop() height_inch?: number;
  @Prop() born: string;
  @Prop() is_hitter: boolean;

  // 투수 전용
  @Prop() stamina?: number;
  @Prop() pitching_clutch?: number;
  @Prop() hits_per_bf?: number;
  @Prop() k_per_bf?: number;
  @Prop() bb_per_bf?: number;
  @Prop() hr_per_bf?: number;
  @Prop() pitch_velocity?: number;
  @Prop() pitch_control?: number;
  @Prop() pitch_movement?: number;

  // 타자 전용
  @Prop() contact_left?: number;
  @Prop() contact_right?: number;
  @Prop() power_left?: number;
  @Prop() power_right?: number;
  @Prop() plate_vision?: number;
  @Prop() plate_discipline?: number;
  @Prop() batting_clutch?: number;
  @Prop() bunting_ability?: number;
  @Prop() drag_bunting_ability?: number;
  @Prop() hitting_durability?: number;

  // 공통
  @Prop() fielding_durability?: number;
  @Prop() fielding_ability?: number;
  @Prop() arm_strength?: number;
  @Prop() arm_accuracy?: number;
  @Prop() reaction_time?: number;
  @Prop() blocking?: number;
  @Prop() speed?: number;
  @Prop() baserunning_ability?: number;
  @Prop() baserunning_aggression?: number;

  @Prop() hit_rank_image?: string;
  @Prop() fielding_rank_image?: string;

  @Prop({
    type: [
      {
        _id: false,
        name: String,
        speed: Number,
        control: Number,
        movement: Number,
      },
    ],
  })
  pitches: {
    name: string;
    speed: number;
    control: number;
    movement: number;
  }[];

  @Prop({
    type: [
      {
        _id: false,
        name: String,
        description: String,
        img: String,
      },
    ],
  })
  quirks: {
    name: string;
    description: string;
    img: string;
  }[];

  @Prop() is_sellable: boolean;
  @Prop() has_augment: boolean;
  @Prop({ type: String }) augment_text?: string | null;
  @Prop({ type: String }) augment_end_date?: string | null;
  @Prop() has_matchup: boolean;

  @Prop({ type: Object }) stars: unknown;
  @Prop({ type: Object }) trend: unknown;
  @Prop() new_rank: number;
  @Prop() has_rank_change: boolean;
  @Prop() event: boolean;
  @Prop() set_name: string;
  @Prop() is_live_set: boolean;
  @Prop() ui_anim_index: number;

  @Prop({ type: [String] })
  locations: string[];
}

export const PlayerCardSchema = SchemaFactory.createForClass(PlayerCard);
