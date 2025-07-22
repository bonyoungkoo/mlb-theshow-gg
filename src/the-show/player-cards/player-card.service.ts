// src/the-show/player-cards/player-card.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlayerCard, PlayerCardDocument } from './player-card.schema';
import axios from 'axios';
import {
  PlayerCardApiResponse,
  PlayerCardItem,
} from '../types/player-card-api-response.interface';

@Injectable()
export class PlayerCardService {
  private readonly logger = new Logger(PlayerCardService.name);

  constructor(
    @InjectModel(PlayerCard.name)
    private readonly playerCardModel: Model<PlayerCardDocument>,
  ) {}

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
      allItems.map((item) => ({
        updateOne: {
          filter: { uuid: item.uuid },
          update: {
            $set: {
              ...this.normalizeItemFields(item),
            },
          },
          upsert: true,
        },
      })),
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
    return card;
  }

  async findByFilters(
    filters: Record<string, string>,
    sortField: keyof PlayerCardItem = 'ovr',
    sortOrder: 'asc' | 'desc' = 'desc',
    page = 1,
    limit = 25,
  ) {
    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};

    for (const key in filters) {
      if (['sort', 'order', 'page', 'limit'].includes(key)) continue;

      const field = key as keyof PlayerCardItem;
      const rawValue = filters[key];

      if (!rawValue) continue;

      if (field === 'name') {
        query[field] = { $regex: rawValue, $options: 'i' };
      } else if (
        [
          'is_hitter',
          'is_sellable',
          'has_augment',
          'has_matchup',
          'event',
        ].includes(field)
      ) {
        query[field] = rawValue === 'true';
      } else {
        const num = Number(rawValue);
        query[field] = isNaN(num) ? rawValue : num;
      }
    }

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
