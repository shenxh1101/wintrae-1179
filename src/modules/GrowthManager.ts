import {
  GrowthRecord,
  LevelChangeRecord,
  MemberAccount,
  AddGrowthResult,
  StorageAdapter,
  Coupon,
} from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { generateId } from '../utils';
import { Logger } from './Logger';
import { RewardManager } from './RewardManager';

export class GrowthManager {
  private storage: StorageAdapter;
  private configManager: ConfigManager;
  private logger: Logger;
  private rewardManager: RewardManager | null = null;

  constructor(
    storage: StorageAdapter,
    configManager: ConfigManager,
    logger: Logger
  ) {
    this.storage = storage;
    this.configManager = configManager;
    this.logger = logger;
  }

  setRewardManager(rewardManager: RewardManager): void {
    this.rewardManager = rewardManager;
  }

  async add(
    memberId: string,
    growth: number,
    source: string,
    options: { bizId?: string; remark?: string } = {}
  ): Promise<AddGrowthResult> {
    if (growth <= 0) {
      const account = await this.storage.getMember(memberId);
      return {
        success: false,
        growth: 0,
        totalGrowth: account?.totalGrowth || 0,
        currentLevel: account?.level || this.configManager.getDefaultLevel(),
        levelChanged: false,
      };
    }

    const account = await this.storage.getMember(memberId);
    if (!account) {
      return {
        success: false,
        growth: 0,
        totalGrowth: 0,
        currentLevel: this.configManager.getDefaultLevel(),
        levelChanged: false,
      };
    }

    const recordId = generateId('gr_');
    const record: GrowthRecord = {
      id: recordId,
      memberId,
      amount: growth,
      source,
      bizId: options.bizId,
      remark: options.remark,
      createTime: Date.now(),
    };

    account.growth += growth;
    account.totalGrowth += growth;

    const oldLevel = account.level;
    const newLevelInfo = this.configManager.getLevelByGrowth(account.growth);
    const newLevel = newLevelInfo.level;
    const levelChanged = oldLevel !== newLevel;

    let levelUpRewards: Coupon[] = [];

    if (levelChanged) {
      account.level = newLevel;
      const changeRecordId = generateId('lc_');
      const changeRecord: LevelChangeRecord = {
        id: changeRecordId,
        memberId,
        fromLevel: oldLevel,
        toLevel: newLevel,
        reason: `成长值达到 ${newLevelInfo.minGrowth}，${newLevel > oldLevel ? '升级' : '降级'}`,
        createTime: Date.now(),
      };
      await this.storage.addLevelChangeRecord(changeRecord);

      if (newLevel > oldLevel && this.rewardManager) {
        levelUpRewards = await this.rewardManager.issueLevelUpRewards(memberId, oldLevel, newLevel);
      }

      await this.logger.log({
        memberId,
        action: 'level_change',
        module: 'growth',
        detail: { fromLevel: oldLevel, toLevel: newLevel, growth: account.growth },
      });
    }

    await this.storage.addGrowthRecord(record);
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'add_growth',
      module: 'growth',
      detail: { growth, source, recordId, bizId: options.bizId, totalGrowth: account.totalGrowth },
    });

    return {
      success: true,
      growth,
      totalGrowth: account.totalGrowth,
      currentLevel: account.level,
      levelChanged,
      oldLevel: levelChanged ? oldLevel : undefined,
      newLevel: levelChanged ? newLevel : undefined,
      levelUpRewards: levelUpRewards.length > 0 ? levelUpRewards : undefined,
    };
  }

  async addFromOrder(
    memberId: string,
    orderAmount: number,
    orderId: string
  ): Promise<AddGrowthResult> {
    const rate = this.configManager.getOrderGrowthRate();
    const growth = Math.floor(orderAmount * rate);
    if (growth <= 0) {
      const account = await this.storage.getMember(memberId);
      return {
        success: true,
        growth: 0,
        totalGrowth: account?.totalGrowth || 0,
        currentLevel: account?.level || this.configManager.getDefaultLevel(),
        levelChanged: false,
      };
    }
    return this.add(memberId, growth, 'order', {
      bizId: orderId,
      remark: `订单消费 ${orderAmount} 元`,
    });
  }

  async getGrowthRecords(memberId: string, limit?: number): Promise<GrowthRecord[]> {
    return this.storage.getGrowthRecords(memberId, limit);
  }

  async getLevelChangeRecords(memberId: string, limit?: number): Promise<LevelChangeRecord[]> {
    return this.storage.getLevelChangeRecords(memberId, limit);
  }
}
