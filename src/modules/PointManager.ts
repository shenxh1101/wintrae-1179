import {
  PointRecord,
  MemberAccount,
  EarnPointsResult,
  SpendPointsResult,
  StorageAdapter,
} from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { generateId, addDays } from '../utils';
import { Logger } from './Logger';
import { GrowthManager } from './GrowthManager';

export class PointManager {
  private storage: StorageAdapter;
  private configManager: ConfigManager;
  private logger: Logger;
  private growthManager: GrowthManager;

  constructor(
    storage: StorageAdapter,
    configManager: ConfigManager,
    logger: Logger,
    growthManager: GrowthManager
  ) {
    this.storage = storage;
    this.configManager = configManager;
    this.logger = logger;
    this.growthManager = growthManager;
  }

  async earn(
    memberId: string,
    points: number,
    source: string,
    options: {
      bizId?: string;
      remark?: string;
      expireDays?: number;
      alsoGrowth?: boolean;
      growthAmount?: number;
    } = {}
  ): Promise<EarnPointsResult> {
    if (points <= 0) {
      return { success: false, points: 0, totalPoints: 0, recordId: '', levelChanged: false };
    }

    const account = await this.storage.getMember(memberId);
    if (!account) {
      return { success: false, points: 0, totalPoints: 0, recordId: '', levelChanged: false };
    }

    const recordId = generateId('pt_');
    const record: PointRecord = {
      id: recordId,
      memberId,
      amount: points,
      type: 'earn',
      source,
      bizId: options.bizId,
      remark: options.remark,
      createTime: Date.now(),
      expireTime: options.expireDays ? addDays(Date.now(), options.expireDays) : undefined,
    };

    account.points += points;
    account.totalPointsEarned += points;

    await this.storage.addPointRecord(record);
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'earn_points',
      module: 'points',
      detail: { points, source, recordId, totalPoints: account.points },
    });

    let levelChanged = false;
    let newLevel: number | undefined;
    let rewards: any[] | undefined;

    if (options.alsoGrowth) {
      const growthAmount = options.growthAmount ?? points;
      const growthResult = await this.growthManager.add(memberId, growthAmount, source, {
        bizId: options.bizId,
        remark: options.remark,
      });
      levelChanged = growthResult.levelChanged;
      newLevel = growthResult.newLevel;
      rewards = growthResult.levelUpRewards;
    }

    return {
      success: true,
      points,
      totalPoints: account.points,
      recordId,
      levelChanged,
      newLevel,
      rewards,
    };
  }

  async spend(
    memberId: string,
    points: number,
    source: string,
    options: { bizId?: string; remark?: string } = {}
  ): Promise<SpendPointsResult> {
    if (points <= 0) {
      return { success: false, points: 0, remainingPoints: 0, recordId: '' };
    }

    const account = await this.storage.getMember(memberId);
    if (!account) {
      return { success: false, points: 0, remainingPoints: 0, recordId: '' };
    }

    if (account.points < points) {
      return { success: false, points: 0, remainingPoints: account.points, recordId: '' };
    }

    const recordId = generateId('pt_');
    const record: PointRecord = {
      id: recordId,
      memberId,
      amount: points,
      type: 'spend',
      source,
      bizId: options.bizId,
      remark: options.remark,
      createTime: Date.now(),
    };

    account.points -= points;
    account.totalPointsSpent += points;

    await this.storage.addPointRecord(record);
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'spend_points',
      module: 'points',
      detail: { points, source, recordId, remainingPoints: account.points },
    });

    return {
      success: true,
      points,
      remainingPoints: account.points,
      recordId,
    };
  }

  async getRecords(memberId: string, limit?: number): Promise<PointRecord[]> {
    return this.storage.getPointRecords(memberId, limit);
  }

  async earnFromOrder(
    memberId: string,
    orderAmount: number,
    orderId: string,
    options: { alsoGrowth?: boolean } = {}
  ): Promise<EarnPointsResult> {
    const rate = this.configManager.getOrderPointRate();
    const points = Math.floor(orderAmount * rate);
    if (points <= 0) {
      const account = await this.storage.getMember(memberId);
      return {
        success: true,
        points: 0,
        totalPoints: account?.points || 0,
        recordId: '',
        levelChanged: false,
      };
    }
    return this.earn(memberId, points, 'order', {
      bizId: orderId,
      remark: `订单消费 ${orderAmount} 元`,
      alsoGrowth: options.alsoGrowth,
    });
  }
}
