import {
  SDKConfig,
  MemberProfile,
  MemberAccount,
  MemberInfoResult,
  EarnPointsResult,
  SpendPointsResult,
  AddGrowthResult,
  SignInResult,
  BirthdayRewardResult,
  CompleteTaskResult,
  IssueCouponResult,
  PointRecord,
  GrowthRecord,
  LevelChangeRecord,
  Coupon,
  TaskConfig,
  MemberLevel,
  BenefitPackage,
  StorageAdapter,
  MakeupSignInResult,
  SignInStatus,
  PlaceOrderResult,
  CouponListResult,
  CouponWithExpireInfo,
  MemberEventQuery,
  MemberEventList,
} from './types';
import { ConfigManager } from './config/ConfigManager';
import { MemoryStorage } from './storage/MemoryStorage';
import { MemberManager } from './modules/MemberManager';
import { PointManager } from './modules/PointManager';
import { GrowthManager } from './modules/GrowthManager';
import { RewardManager } from './modules/RewardManager';
import { Logger } from './modules/Logger';
import { EventManager } from './modules/EventManager';

export class MemberGrowthSDK {
  private config: SDKConfig;
  private configManager: ConfigManager;
  private storage: StorageAdapter;
  private logger: Logger;
  private memberManager: MemberManager;
  private pointManager: PointManager;
  private growthManager: GrowthManager;
  private rewardManager: RewardManager;
  private eventManager: EventManager;

  constructor(config: SDKConfig) {
    const storage: StorageAdapter = config.storage || new MemoryStorage();
    this.config = {
      ...config,
      storage,
    };
    this.configManager = new ConfigManager(this.config);
    this.storage = storage;
    this.logger = new Logger(this.config);
    this.growthManager = new GrowthManager(this.storage, this.configManager, this.logger);
    this.pointManager = new PointManager(this.storage, this.configManager, this.logger, this.growthManager);
    this.memberManager = new MemberManager(this.storage, this.configManager, this.logger);
    this.rewardManager = new RewardManager(
      this.storage,
      this.configManager,
      this.logger,
      this.pointManager,
      this.growthManager,
      this.memberManager
    );
    this.growthManager.setRewardManager(this.rewardManager);
    this.eventManager = new EventManager(this.storage);
  }

  async register(profile: MemberProfile): Promise<MemberAccount> {
    return this.memberManager.register(profile);
  }

  async getMemberInfo(memberId: string): Promise<MemberInfoResult | null> {
    return this.memberManager.getMemberInfo(memberId);
  }

  async updateProfile(memberId: string, updates: Partial<MemberProfile>): Promise<MemberAccount | null> {
    return this.memberManager.updateProfile(memberId, updates);
  }

  earnPoints(
    memberId: string,
    points: number,
    source: string,
    options?: { bizId?: string; remark?: string; alsoGrowth?: boolean }
  ): Promise<EarnPointsResult> {
    return this.pointManager.earn(memberId, points, source, options);
  }

  spendPoints(
    memberId: string,
    points: number,
    source: string,
    options?: { bizId?: string; remark?: string }
  ): Promise<SpendPointsResult> {
    return this.pointManager.spend(memberId, points, source, options);
  }

  earnFromOrder(
    memberId: string,
    orderAmount: number,
    orderId: string,
    options?: { alsoGrowth?: boolean }
  ): Promise<EarnPointsResult> {
    return this.pointManager.earnFromOrder(memberId, orderAmount, orderId, options);
  }

  addGrowth(
    memberId: string,
    growth: number,
    source: string,
    options?: { bizId?: string; remark?: string }
  ): Promise<AddGrowthResult> {
    return this.growthManager.add(memberId, growth, source, options);
  }

  addGrowthFromOrder(memberId: string, orderAmount: number, orderId: string): Promise<AddGrowthResult> {
    return this.growthManager.addFromOrder(memberId, orderAmount, orderId);
  }

  signIn(memberId: string, options?: { returnMemberInfo?: boolean }): Promise<SignInResult> {
    return this.rewardManager.signIn(memberId, options);
  }

  makeupSignIn(memberId: string, targetDate: string | number): Promise<MakeupSignInResult> {
    return this.rewardManager.makeupSignIn(memberId, targetDate);
  }

  getSignInStatus(memberId: string): Promise<SignInStatus> {
    return this.rewardManager.getSignInStatus(memberId);
  }

  placeOrder(memberId: string, orderAmount: number, orderId: string): Promise<PlaceOrderResult> {
    return this.rewardManager.placeOrder(memberId, orderAmount, orderId);
  }

  triggerBirthdayReward(memberId: string): Promise<BirthdayRewardResult> {
    return this.rewardManager.triggerBirthdayReward(memberId);
  }

  completeTask(memberId: string, taskId: string): Promise<CompleteTaskResult> {
    return this.rewardManager.completeTask(memberId, taskId);
  }

  issueCoupon(memberId: string, templateId: string): Promise<IssueCouponResult> {
    return this.rewardManager.issueCoupon(memberId, templateId);
  }

  getCoupons(memberId: string, status?: 'unused' | 'used' | 'expired'): Promise<Coupon[]> {
    return this.rewardManager.getCoupons(memberId, status);
  }

  getCouponList(memberId: string): Promise<CouponListResult> {
    return this.rewardManager.getCouponList(memberId);
  }

  getExpiringCoupons(memberId: string, days?: number): Promise<CouponWithExpireInfo[]> {
    return this.rewardManager.getExpiringCoupons(memberId, days);
  }

  useCoupon(couponId: string, orderId: string): Promise<boolean> {
    return this.rewardManager.useCoupon(couponId, orderId);
  }

  getPointRecords(memberId: string, limit?: number): Promise<PointRecord[]> {
    return this.pointManager.getRecords(memberId, limit);
  }

  getGrowthRecords(memberId: string, limit?: number): Promise<GrowthRecord[]> {
    return this.growthManager.getGrowthRecords(memberId, limit);
  }

  getLevelChangeRecords(memberId: string, limit?: number): Promise<LevelChangeRecord[]> {
    return this.growthManager.getLevelChangeRecords(memberId, limit);
  }

  getMemberEvents(memberId: string, query?: MemberEventQuery): Promise<MemberEventList> {
    return this.eventManager.getMemberEvents(memberId, query);
  }

  getLevels(): MemberLevel[] {
    return this.configManager.getLevels();
  }

  getBenefitPackages(level?: number): BenefitPackage[] {
    return this.configManager.getBenefitPackages(level);
  }

  getTasks(): TaskConfig[] {
    return this.configManager.getTasks();
  }

  updateConfig(partialConfig: Partial<SDKConfig>): void {
    this.configManager.updateConfig(partialConfig);
  }
}

export default MemberGrowthSDK;
export * from './types';
export { ConfigManager } from './config/ConfigManager';
export { MemoryStorage } from './storage/MemoryStorage';
