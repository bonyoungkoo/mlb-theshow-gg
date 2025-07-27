// src/the-show/player-cards/player-card.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { PlayerCard, PlayerCardDocument } from './player-card.schema';
import axios from 'axios';
import {
  Pitch,
  PlayerCardApiResponse,
  PlayerCardItem,
  PlayerCardSearchFilters,
} from '../types/player-card-api-response.interface';

@Injectable()
export class PlayerCardService {
  private readonly logger = new Logger(PlayerCardService.name);

  constructor(
    @InjectModel(PlayerCard.name)
    private readonly playerCardModel: Model<PlayerCardDocument>,
  ) {}

  private parseHeightToInch(heightStr: string): number | null {
    const match = heightStr.match(/(\d+)'(\d+)"/);
    if (!match) return null;

    const feet = parseInt(match[1], 10);
    const inches = parseInt(match[2], 10);
    return feet * 12 + inches;
  }

  async fetchAndSaveCards(): Promise<void> {
    const BASE_URL = 'https://mlb25.theshow.com/apis/items.json?type=mlb_card';

    // 1. 첫 페이지 요청
    const firstResponse = await axios.get<PlayerCardApiResponse>(
      `${BASE_URL}&page=1`,
    );
    const totalPages = firstResponse.data.total_pages;
    const allItems = [...firstResponse.data.items];

    this.logger.log(`📄 총 페이지 수: ${totalPages}`);

    // 2. 2페이지부터 끝까지 요청
    for (let page = 2; page <= totalPages; page++) {
      const { data } = await axios.get<PlayerCardApiResponse>(
        `${BASE_URL}&page=${page}`,
      );
      allItems.push(...data.items);
    }

    this.logger.log(`📦 전체 카드 수: ${allItems.length}`);

    // 3. bulkWrite로 upsert 저장
    await this.playerCardModel.bulkWrite(
      allItems.map((item) => {
        const normalized = this.normalizeItemFields(item);
        const heightInch = this.parseHeightToInch(item.height ?? '');

        return {
          updateOne: {
            filter: { uuid: item.uuid },
            update: {
              $set: {
                ...normalized,
                ...(heightInch ? { height_inch: heightInch } : {}),
              },
            },
            upsert: true,
          },
        };
      }),
    );
    this.logger.log(`✅ 저장 완료: ${allItems.length}장`);
  }

  private normalizeItemFields(item: PlayerCardItem): Record<string, any> {
    return Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, value ?? null]),
    );
  }

  async findAll(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const total = await this.playerCardModel.countDocuments();

    const cards = await this.playerCardModel
      .find()
      .sort({ ovr: -1 }) // ovr 내림차순
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: cards,
    };
  }

  async findOneByUuid(uuid: string): Promise<PlayerCardItem> {
    const card = await this.playerCardModel.findOne({ uuid }).lean();
    if (!card) {
      throw new NotFoundException(
        `선수 카드(uuid: ${uuid})를 찾을 수 없습니다.`,
      );
    }
    return card as unknown as PlayerCardItem;
  }

  async findByFilters(
    filters: PlayerCardSearchFilters,
    sortField: keyof PlayerCardItem = 'ovr',
    sortOrder: 'asc' | 'desc' = 'desc',
    page = 1,
    limit = 25,
  ) {
    const skip = (page - 1) * limit;

    const query: FilterQuery<PlayerCardItem> = {};

    const booleanFields: (keyof PlayerCardItem)[] = [
      'is_hitter',
      'is_sellable',
      'has_augment',
      'has_matchup',
      'event',
    ];

    for (const key in filters) {
      if (['sort', 'order', 'page', 'limit', 'pitches', 'quirks'].includes(key))
        continue;

      const rawValue = filters[key as keyof PlayerCardSearchFilters];
      if (!rawValue) continue;

      // ✅ height (배제)
      if (
        key === 'height' &&
        Array.isArray(rawValue) &&
        rawValue.length === 2 &&
        typeof rawValue[0] === 'number' &&
        typeof rawValue[1] === 'number'
      ) {
        const [min, max] = rawValue;
        query.height_inch = { $gte: min, $lte: max };
        continue;
      }

      // ✅ 범위 값: [숫자, 숫자]
      if (
        Array.isArray(rawValue) &&
        typeof rawValue[0] === 'number' &&
        typeof rawValue[1] === 'number'
      ) {
        query[key] = {
          $gte: rawValue[0],
          $lte: rawValue[1],
        };
        continue;
      }

      // ✅ 문자열 검색
      if (key === 'name') {
        query.name = { $regex: rawValue, $options: 'i' };
        continue;
      }

      // ✅ boolean 필드 처리
      if (booleanFields.includes(key as keyof PlayerCardItem)) {
        query[key] = rawValue === 'true';
        continue;
      }

      // ✅ 숫자 or 문자열 기본 처리
      const num = Number(rawValue);
      query[key] = isNaN(num) ? rawValue : num;
    }

    // ✅ 구종
    if (Array.isArray(filters.pitches)) {
      const pitchQueries = filters.pitches.map((cond: Pitch) => {
        const pitchQuery: Record<string, unknown> = {
          name: cond.name,
        };

        if (cond.speed) {
          pitchQuery.speed = { $gte: cond.speed[0], $lte: cond.speed[1] };
        }
        if (cond.control) {
          pitchQuery.control = {
            $gte: cond.control[0],
            $lte: cond.control[1],
          };
        }
        if (cond.movement) {
          pitchQuery.break = { $gte: cond.movement[0], $lte: cond.movement[1] };
        }

        return {
          pitches: {
            $elemMatch: pitchQuery,
          },
        };
      });

      query.$and = [...(query.$and || []), ...pitchQueries];
    }

    // ✅ quirks
    if (Array.isArray(filters.quirks) && filters.quirks.length > 0) {
      query.quirks = {
        $all: filters.quirks.map((q: string) => ({
          $elemMatch: { name: q },
        })),
      };
    }

    console.log('query', query);

    const total = await this.playerCardModel.countDocuments(query);

    const sortOption: Record<string, 1 | -1> = {
      [sortField]: sortOrder === 'asc' ? 1 : -1,
    };

    const data = await this.playerCardModel
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sortField,
      sortOrder,
      data,
    };
  }
}
