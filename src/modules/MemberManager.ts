import {
  MemberProfile,
  MemberAccount,
  StorageAdapter,
  MemberInfoResult,
  BenefitPackage,
} from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { isSameDay } from '../utils';
import { Logger } from './Logger';

export class MemberManager {
  private storage: StorageAdapter;
  private configManager: ConfigManager;
  private logger: Logger;

  constructor(storage: StorageAdapter, configManager: ConfigManager, logger: Logger) {
    this.storage = storage;
    this.configManager = configManager;
    this.logger = logger;
  }

  async register(profile: MemberProfile): Promise<MemberAccount> {
    const existing = await this.storage.getMember(profile.memberId);
    if (existing) {
      return existing;
    }

    const defaultLevel = this.configManager.getDefaultLevel();
    const account: MemberAccount = {
      memberId: profile.memberId,
      profile,
      level: defaultLevel,
      growth: 0,
      totalGrowth: 0,
      points: 0,
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      continuousSignInDays: 0,
      totalSignInDays: 0,
      signInCycle: 1,
      makeupUsedCount: 0,
    };

    await this.storage.saveMember(account);
    await this.logger.log({
      memberId: profile.memberId,
      action: 'register',
      module: 'member',
      detail: { profile },
    });

    return account;
  }

  async getAccount(memberId: string): Promise<MemberAccount | null> {
    return this.storage.getMember(memberId);
  }

  async getMemberInfo(memberId: string): Promise<MemberInfoResult | null> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return null;
    }

    const levelInfo = this.configManager.getLevel(account.level)!;
    const nextLevel = this.configManager.getNextLevel(account.level);
    const benefits = this.configManager.getBenefitPackages(account.level);
    const todaySignedIn = account.lastSignInDate
      ? isSameDay(new Date(account.lastSignInDate).getTime(), Date.now())
      : false;

    return {
      profile: account.profile,
      level: account.level,
      levelName: levelInfo.name,
      levelInfo,
      growth: account.growth,
      totalGrowth: account.totalGrowth,
      nextLevelGrowth: nextLevel?.minGrowth,
      points: account.points,
      totalPointsEarned: account.totalPointsEarned,
      totalPointsSpent: account.totalPointsSpent,
      benefits,
      continuousSignInDays: account.continuousSignInDays,
      totalSignInDays: account.totalSignInDays,
      todaySignedIn,
    };
  }

  async updateProfile(memberId: string, updates: Partial<MemberProfile>): Promise<MemberAccount | null> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return null;
    }

    account.profile = { ...account.profile, ...updates };
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'update_profile',
      module: 'member',
      detail: { updates },
    });

    return account;
  }

  async saveAccount(account: MemberAccount): Promise<void> {
    await this.storage.saveMember(account);
  }
}
