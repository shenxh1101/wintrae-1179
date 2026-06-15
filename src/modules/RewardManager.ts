import {
  Coupon,
  CouponTemplate,
  SignInResult,
  BirthdayRewardResult,
  CompleteTaskResult,
  IssueCouponResult,
  TaskRecord,
  StorageAdapter,
  MemberAccount,
  CouponWithExpireInfo,
  MakeupSignInResult,
  SignInCalendarItem,
  SignInStatus,
  SignInConfig,
  SignInDailyRecord,
  PlaceOrderResult,
  RefundOrderResult,
  BenefitPackage,
  CouponListResult,
  MemberInfoResult,
} from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { generateId, addDays, formatDate, isYesterday, isSameDay, isBirthday, getCurrentYear, isSameWeek } from '../utils';
import { Logger } from './Logger';
import { PointManager } from './PointManager';
import { GrowthManager } from './GrowthManager';
import { MemberManager } from './MemberManager';

export class RewardManager {
  private storage: StorageAdapter;
  private configManager: ConfigManager;
  private logger: Logger;
  private pointManager: PointManager;
  private growthManager: GrowthManager;
  private memberManager: MemberManager;

  constructor(
    storage: StorageAdapter,
    configManager: ConfigManager,
    logger: Logger,
    pointManager: PointManager,
    growthManager: GrowthManager,
    memberManager: MemberManager
  ) {
    this.storage = storage;
    this.configManager = configManager;
    this.logger = logger;
    this.pointManager = pointManager;
    this.growthManager = growthManager;
    this.memberManager = memberManager;
  }

  private async saveSignInDailyRecord(record: SignInDailyRecord): Promise<void> {
    if (this.storage.addSignInDailyRecord) {
      const result = this.storage.addSignInDailyRecord(record);
      if (result instanceof Promise) await result;
    }
  }

  private async getSignInDailyRecords(memberId: string, startDate?: string, endDate?: string): Promise<SignInDailyRecord[]> {
    if (this.storage.getSignInDailyRecords) {
      const result = this.storage.getSignInDailyRecords(memberId, startDate, endDate);
      return result instanceof Promise ? await result : result;
    }
    return [];
  }

  private async getPointRecordsByBizId(bizId: string) {
    if (this.storage.getPointRecordsByBizId) {
      const result = this.storage.getPointRecordsByBizId(bizId);
      return result instanceof Promise ? await result : result;
    }
    return [];
  }

  private async getGrowthRecordsByBizId(bizId: string) {
    if (this.storage.getGrowthRecordsByBizId) {
      const result = this.storage.getGrowthRecordsByBizId(bizId);
      return result instanceof Promise ? await result : result;
    }
    return [];
  }

  private getMakeupConfig() {
    const signInConfig = this.configManager.getSignInConfig();
    return {
      maxMakeupCount: signInConfig?.makeupConfig?.maxMakeupCount ?? 3,
      makeupCostPoints: signInConfig?.makeupConfig?.makeupCostPoints ?? 0,
      makeupWindowDays: signInConfig?.makeupConfig?.makeupWindowDays ?? 7,
    };
  }

  async issueCoupon(memberId: string, templateId: string, source?: string): Promise<IssueCouponResult> {
    const template = this.configManager.getCouponTemplate(templateId);
    if (!template) {
      throw new Error(`Coupon template not found: ${templateId}`);
    }

    const coupon: Coupon = {
      id: generateId('cp_'),
      memberId,
      templateId: template.id,
      name: template.name,
      type: template.type,
      value: template.value,
      threshold: template.threshold,
      status: 'unused',
      createTime: Date.now(),
      expireTime: addDays(Date.now(), template.validDays),
      source: source || 'system',
    };

    await this.storage.addCoupon(coupon);
    await this.logger.log({
      memberId,
      action: 'issue_coupon',
      module: 'reward',
      detail: { couponId: coupon.id, templateId, couponName: template.name, source: source || 'system' },
    });

    return { success: true, coupon };
  }

  async getCoupons(
    memberId: string,
    status?: 'unused' | 'used' | 'expired' | 'revoked'
  ): Promise<Coupon[]> {
    await this.refreshCouponStatus(memberId);
    const result = this.storage.getCoupons(memberId, status);
    const coupons: Coupon[] = result instanceof Promise ? await result : result;
    return coupons;
  }

  async refreshCouponStatus(memberId: string): Promise<void> {
    const allResult = this.storage.getCoupons(memberId, 'unused');
    const allCoupons: Coupon[] = allResult instanceof Promise ? await allResult : allResult;
    const now = Date.now();
    for (const coupon of allCoupons) {
      if (coupon.status === 'unused' && coupon.expireTime < now) {
        await this.storage.updateCoupon(coupon.id, { status: 'expired' });
      }
    }
  }

  async getCouponList(memberId: string): Promise<CouponListResult> {
    await this.refreshCouponStatus(memberId);
    const unusedResult = this.storage.getCoupons(memberId, 'unused');
    const usedResult = this.storage.getCoupons(memberId, 'used');
    const expiredResult = this.storage.getCoupons(memberId, 'expired');
    const revokedResult = this.storage.getCoupons(memberId, 'revoked');
    const [unusedRaw, usedRaw, expiredRaw, revokedRaw] = await Promise.all([
      unusedResult instanceof Promise ? await unusedResult : unusedResult,
      usedResult instanceof Promise ? await usedResult : usedResult,
      expiredResult instanceof Promise ? await expiredResult : expiredResult,
      revokedResult instanceof Promise ? await revokedResult : revokedResult,
    ]);
    const now = Date.now();
    const expiringThreshold = addDays(now, 7);

    const enrich = (cs: Coupon[]): CouponWithExpireInfo[] =>
      cs
        .sort((a, b) => b.createTime - a.createTime)
        .map(c => {
          const msLeft = c.expireTime - now;
          const daysLeft = msLeft > 0 ? Math.ceil(msLeft / 86400000) : 0;
          return {
            ...c,
            isExpiring: c.status === 'unused' && c.expireTime <= expiringThreshold && c.expireTime >= now,
            daysLeft,
          };
        });

    const unused = enrich(unusedRaw);
    const used = enrich(usedRaw);
    const expired = enrich(expiredRaw);
    const revoked = enrich(revokedRaw);
    const expiring = unused.filter(c => c.isExpiring).sort((a, b) => a.expireTime - b.expireTime);

    return {
      unused,
      used,
      expired,
      revoked,
      total: unused.length + used.length + expired.length + revoked.length,
      expiring,
      expiringCount: expiring.length,
      unusedCount: unused.length,
      usedCount: used.length,
      expiredCount: expired.length,
      revokedCount: revoked.length,
    };
  }

  async useCoupon(couponId: string, orderId: string): Promise<boolean> {
    const rawCoupon = (this.storage as any).getCouponById
      ? await (this.storage as any).getCouponById(couponId)
      : null;

    let targetCoupon: Coupon | null = rawCoupon;
    if (!targetCoupon) return false;

    await this.refreshCouponStatus(targetCoupon.memberId);

    const freshCoupon = (this.storage as any).getCouponById
      ? await (this.storage as any).getCouponById(couponId)
      : targetCoupon;

    if (!freshCoupon) return false;
    if (freshCoupon.status !== 'unused') return false;

    await this.storage.updateCoupon(couponId, {
      status: 'used',
      useTime: Date.now(),
      orderId,
    });

    await this.logger.log({
      memberId: targetCoupon.memberId,
      action: 'use_coupon',
      module: 'reward',
      detail: { couponId, orderId },
    });

    return true;
  }

  private computeCycleDay(continuousDays: number, cycleDays: number): { day: number; isCycleComplete: boolean } {
    if (continuousDays === 0) return { day: 0, isCycleComplete: false };
    const mod = continuousDays % cycleDays;
    const isCycleComplete = mod === 0;
    const day = isCycleComplete ? cycleDays : mod;
    return { day, isCycleComplete };
  }

  async signIn(memberId: string, options?: { returnMemberInfo?: boolean }): Promise<SignInResult> {
    const account = await this.storage.getMember(memberId);
    const defaultLevel = this.configManager.getDefaultLevel();
    if (!account) {
      return {
        success: false, day: 0, cycle: 1, isContinuous: false,
        isCycleComplete: false, isMakeup: false, totalPoints: 0, currentLevel: defaultLevel,
      };
    }

    const today = formatDate(Date.now());
    if (account.lastSignInDate && isSameDay(new Date(account.lastSignInDate).getTime(), Date.now())) {
      const signInConfig = this.configManager.getSignInConfig();
      const cycleDays = signInConfig?.cycleDays || 7;
      const { day } = this.computeCycleDay(account.continuousSignInDays, cycleDays);
      return {
        success: false, day, cycle: account.signInCycle || 1, isContinuous: true,
        isCycleComplete: false, isMakeup: false, totalPoints: account.points, currentLevel: account.level,
      };
    }

    const signInConfig = this.configManager.getSignInConfig();
    const cycleDays = signInConfig?.cycleDays || 7;

    let isContinuous = false;
    if (account.lastSignInDate && isYesterday(new Date(account.lastSignInDate).getTime())) {
      isContinuous = true;
      account.continuousSignInDays += 1;
    } else {
      account.continuousSignInDays = 1;
    }

    const cycleResult = this.computeCycleDay(account.continuousSignInDays, cycleDays);
    if (cycleResult.isCycleComplete) {
      account.signInCycle = (account.signInCycle || 1) + 1;
    }

    account.lastSignInDate = today;
    account.totalSignInDays += 1;

    const day = cycleResult.day;
    const rewardConfig = signInConfig?.rewards?.find(r => r.day === day);

    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (rewardConfig) {
      if (rewardConfig.points) {
        const pointsResult = await this.pointManager.earn(memberId, rewardConfig.points, 'sign_in', { remark: `签到第${day}天` });
        earnedPoints = pointsResult.points;
      }
      if (rewardConfig.growth) {
        const growthResult = await this.growthManager.add(memberId, rewardConfig.growth, 'sign_in', { remark: `签到第${day}天` });
        earnedGrowth = growthResult.growth;
      }
      if (rewardConfig.couponTemplateId) {
        const couponResult = await this.issueCoupon(memberId, rewardConfig.couponTemplateId, `签到第${day}天奖励`);
        coupon = couponResult.coupon;
      }
    } else {
      const defaultPoints = 10;
      const pointsResult = await this.pointManager.earn(memberId, defaultPoints, 'sign_in', { remark: `签到第${day}天` });
      earnedPoints = pointsResult.points;
    }

    const dailyRecord: SignInDailyRecord = {
      id: generateId('sd_'),
      memberId,
      date: today,
      type: 'normal',
      dayInCycle: day,
      cycle: cycleResult.isCycleComplete ? (account.signInCycle - 1) : account.signInCycle,
      points: earnedPoints,
      growth: earnedGrowth,
      couponId: coupon?.id,
      createTime: Date.now(),
    };
    await this.saveSignInDailyRecord(dailyRecord);
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'sign_in',
      module: 'reward',
      detail: { day, cycle: account.signInCycle, isContinuous, points: earnedPoints, growth: earnedGrowth, isCycleComplete: cycleResult.isCycleComplete, date: today },
    });

    const memberInfo = options?.returnMemberInfo ? await this.memberManager.getMemberInfo(memberId) : undefined;

    return {
      success: true, day, cycle: account.signInCycle, isContinuous,
      isCycleComplete: cycleResult.isCycleComplete, isMakeup: false,
      points: earnedPoints, growth: earnedGrowth, coupon,
      totalPoints: account.points, currentLevel: account.level, memberInfo,
    };
  }

  async makeupSignIn(memberId: string, targetDate: string | number): Promise<MakeupSignInResult> {
    const account = await this.storage.getMember(memberId);
    const defaultLevel = this.configManager.getDefaultLevel();
    const targetDateStr = typeof targetDate === 'number' ? formatDate(targetDate) : targetDate;

    if (!account) {
      return {
        success: false, day: 0, cycle: 1, isContinuous: false,
        isCycleComplete: false, isMakeup: true, totalPoints: 0, currentLevel: defaultLevel, makeupDate: targetDateStr,
      };
    }

    const today = formatDate(Date.now());

    if (targetDateStr === today) {
      const signInResult = await this.signIn(memberId, { returnMemberInfo: true });
      return { ...signInResult, isMakeup: true, makeupDate: targetDateStr };
    }

    const targetTime = new Date(targetDateStr).getTime();
    if (targetTime > Date.now()) {
      return {
        success: false, day: 0, cycle: account.signInCycle || 1, isContinuous: false,
        isCycleComplete: false, isMakeup: true, totalPoints: account.points, currentLevel: account.level, makeupDate: targetDateStr,
        makeupCost: 0, makeupRemaining: 0,
      };
    }

    const makeupConfig = this.getMakeupConfig();
    const makeupRemaining = makeupConfig.maxMakeupCount - (account.makeupUsedCount || 0);

    if (makeupRemaining <= 0) {
      return {
        success: false, day: 0, cycle: account.signInCycle || 1, isContinuous: false,
        isCycleComplete: false, isMakeup: true, totalPoints: account.points, currentLevel: account.level, makeupDate: targetDateStr,
        makeupCost: makeupConfig.makeupCostPoints, makeupRemaining: 0,
      };
    }

    const existingRecords = await this.getSignInDailyRecords(memberId, targetDateStr, targetDateStr);
    const alreadySigned = existingRecords.some(r => r.date === targetDateStr);
    if (alreadySigned) {
      return {
        success: false, day: 0, cycle: account.signInCycle || 1, isContinuous: false,
        isCycleComplete: false, isMakeup: true, totalPoints: account.points, currentLevel: account.level, makeupDate: targetDateStr,
        makeupCost: 0, makeupRemaining,
      };
    }

    const daysDiff = Math.ceil((Date.now() - targetTime) / 86400000);
    if (daysDiff > makeupConfig.makeupWindowDays) {
      return {
        success: false, day: 0, cycle: account.signInCycle || 1, isContinuous: false,
        isCycleComplete: false, isMakeup: true, totalPoints: account.points, currentLevel: account.level, makeupDate: targetDateStr,
        makeupCost: makeupConfig.makeupCostPoints, makeupRemaining,
      };
    }

    if (makeupConfig.makeupCostPoints > 0 && account.points < makeupConfig.makeupCostPoints) {
      return {
        success: false, day: 0, cycle: account.signInCycle || 1, isContinuous: false,
        isCycleComplete: false, isMakeup: true, totalPoints: account.points, currentLevel: account.level, makeupDate: targetDateStr,
        makeupCost: makeupConfig.makeupCostPoints, makeupRemaining,
      };
    }

    if (makeupConfig.makeupCostPoints > 0) {
      await this.pointManager.spend(memberId, makeupConfig.makeupCostPoints, 'makeup_sign_in', {
        remark: `补签 ${targetDateStr} 扣除积分`,
      });
    }

    const signInConfig = this.configManager.getSignInConfig();
    const cycleDays = signInConfig?.cycleDays || 7;
    const { day: currentDay, isCycleComplete } = this.computeCycleDay(account.continuousSignInDays, cycleDays);
    const makeupDay = Math.min(Math.max(1, currentDay + 1), cycleDays);
    const rewardConfig = signInConfig?.rewards?.find(r => r.day === makeupDay);

    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (rewardConfig) {
      if (rewardConfig.points) {
        const pointsResult = await this.pointManager.earn(memberId, rewardConfig.points, 'sign_in', { remark: `补签第${makeupDay}天 (${targetDateStr})` });
        earnedPoints = pointsResult.points;
      }
      if (rewardConfig.growth) {
        const growthResult = await this.growthManager.add(memberId, rewardConfig.growth, 'sign_in', { remark: `补签第${makeupDay}天 (${targetDateStr})` });
        earnedGrowth = growthResult.growth;
      }
      if (rewardConfig.couponTemplateId) {
        const couponResult = await this.issueCoupon(memberId, rewardConfig.couponTemplateId, `补签第${makeupDay}天奖励`);
        coupon = couponResult.coupon;
      }
    }

    account.continuousSignInDays = Math.min(account.continuousSignInDays + 1, cycleDays);
    account.totalSignInDays += 1;
    account.makeupUsedCount = (account.makeupUsedCount || 0) + 1;
    account.lastSignInDate = today;

    const afterCycle = this.computeCycleDay(account.continuousSignInDays, cycleDays);
    if (afterCycle.isCycleComplete && !isCycleComplete) {
      account.signInCycle = (account.signInCycle || 1) + 1;
    }

    const dailyRecord: SignInDailyRecord = {
      id: generateId('sd_'),
      memberId,
      date: targetDateStr,
      type: 'makeup',
      dayInCycle: makeupDay,
      cycle: account.signInCycle,
      points: earnedPoints,
      growth: earnedGrowth,
      couponId: coupon?.id,
      createTime: Date.now(),
    };
    await this.saveSignInDailyRecord(dailyRecord);
    await this.storage.saveMember(account);

    const newMakeupRemaining = makeupConfig.maxMakeupCount - account.makeupUsedCount;
    await this.logger.log({
      memberId,
      action: 'makeup_sign_in',
      module: 'reward',
      detail: { makeupDate: targetDateStr, day: makeupDay, points: earnedPoints, growth: earnedGrowth, makeupCost: makeupConfig.makeupCostPoints, makeupRemaining: newMakeupRemaining },
    });

    const memberInfo = await this.memberManager.getMemberInfo(memberId);
    return {
      success: true, day: makeupDay, cycle: account.signInCycle, isContinuous: true,
      isCycleComplete: afterCycle.isCycleComplete, isMakeup: true,
      points: earnedPoints, growth: earnedGrowth, coupon,
      totalPoints: account.points, currentLevel: account.level, memberInfo,
      makeupDate: targetDateStr, makeupCost: makeupConfig.makeupCostPoints, makeupRemaining: newMakeupRemaining,
    };
  }

  async getSignInStatus(memberId: string): Promise<SignInStatus> {
    const account = await this.storage.getMember(memberId);
    const signInConfig = this.configManager.getSignInConfig();
    const cycleDays = signInConfig?.cycleDays || 7;
    const makeupConfig = this.getMakeupConfig();

    const defaultStatus: SignInStatus = {
      todaySignedIn: false, continuousSignInDays: 0, totalSignInDays: 0,
      currentCycle: 1, currentDay: 0, cycleDays, cycleProgress: `0/${cycleDays}`,
      calendar: [], currentRewards: [], totalRewards: signInConfig?.rewards || [],
      makeupUsedCount: 0, makeupMaxCount: makeupConfig.maxMakeupCount,
      makeupRemaining: makeupConfig.maxMakeupCount, makeupCostPoints: makeupConfig.makeupCostPoints,
      makeupWindowDays: makeupConfig.makeupWindowDays,
    };

    if (!account) return defaultStatus;

    const today = Date.now();
    const todayStr = formatDate(today);
    const todaySignedIn = account.lastSignInDate
      ? isSameDay(new Date(account.lastSignInDate).getTime(), today)
      : false;

    const { day } = this.computeCycleDay(account.continuousSignInDays, cycleDays);

    const startDate = formatDate(addDays(today, -(cycleDays - 1)));
    const dailyRecords = await this.getSignInDailyRecords(memberId, startDate, todayStr);
    const dailyMap = new Map<string, SignInDailyRecord>();
    for (const r of dailyRecords) {
      dailyMap.set(r.date, r);
    }

    const calendar: SignInCalendarItem[] = [];
    for (let i = 0; i < cycleDays; i++) {
      const d = addDays(today, -(cycleDays - 1 - i));
      const dateStr = formatDate(d);
      const dayInCycle = i + 1;
      const record = dailyMap.get(dateStr);
      const reward = signInConfig?.rewards?.find(r => r.day === dayInCycle);
      const isPast = d < today;
      const isToday = dateStr === todayStr;

      let type: 'normal' | 'makeup' | 'none' = 'none';
      let signedIn = false;
      if (record) {
        signedIn = true;
        type = record.type;
      }

      let canMakeup = false;
      if (!signedIn && isPast) {
        const daysDiff = Math.ceil((today - d) / 86400000);
        if (daysDiff <= makeupConfig.makeupWindowDays) {
          const remaining = makeupConfig.maxMakeupCount - (account.makeupUsedCount || 0);
          if (remaining > 0) {
            canMakeup = true;
          }
        }
      }

      calendar.push({ date: dateStr, signedIn, type, dayInCycle, reward, canMakeup });
    }

    const currentRewards = (signInConfig?.rewards || []).filter(r => r.day > day).slice(0, 3);
    const expiringCoupons = await this.getExpiringCoupons(memberId, 7);
    const makeupRemaining = makeupConfig.maxMakeupCount - (account.makeupUsedCount || 0);

    return {
      todaySignedIn,
      continuousSignInDays: account.continuousSignInDays,
      totalSignInDays: account.totalSignInDays,
      currentCycle: account.signInCycle || 1,
      currentDay: day,
      cycleDays,
      cycleProgress: `${day}/${cycleDays}`,
      calendar,
      currentRewards,
      totalRewards: signInConfig?.rewards || [],
      expiringCoupons,
      makeupUsedCount: account.makeupUsedCount || 0,
      makeupMaxCount: makeupConfig.maxMakeupCount,
      makeupRemaining: Math.max(0, makeupRemaining),
      makeupCostPoints: makeupConfig.makeupCostPoints,
      makeupWindowDays: makeupConfig.makeupWindowDays,
    };
  }

  async placeOrder(memberId: string, orderAmount: number, orderId: string): Promise<PlaceOrderResult> {
    const account = await this.storage.getMember(memberId);
    const defaultLevel = this.configManager.getDefaultLevel();
    if (!account) {
      return {
        success: false, orderId, orderAmount, pointsEarned: 0, pointsRate: this.configManager.getOrderPointRate(),
        growthEarned: 0, growthRate: this.configManager.getOrderGrowthRate(), totalPoints: 0, totalGrowth: 0,
        currentLevel: defaultLevel, currentLevelName: this.configManager.getLevel(defaultLevel)?.name || '',
        levelChanged: false, levelUpRewards: [], benefits: [], privileges: [], memberInfo: null,
      };
    }

    const pointsRate = this.configManager.getOrderPointRate();
    const growthRate = this.configManager.getOrderGrowthRate();
    const pointsEarned = Math.floor(orderAmount * pointsRate);
    const growthEarned = Math.floor(orderAmount * growthRate);

    const oldLevel = account.level;
    let levelUpRewards: Coupon[] = [];

    if (pointsEarned > 0) {
      await this.pointManager.earn(memberId, pointsEarned, 'order', { bizId: orderId, remark: `订单消费 ${orderAmount} 元` });
    }

    if (growthEarned > 0) {
      const growthResult = await this.growthManager.add(memberId, growthEarned, 'order', { bizId: orderId, remark: `订单消费 ${orderAmount} 元` });
      if (growthResult.levelChanged && growthResult.levelUpRewards) {
        levelUpRewards = growthResult.levelUpRewards;
      }
    }

    const updatedAccount = await this.storage.getMember(memberId);
    const freshAccount = updatedAccount!;
    const levelChanged = freshAccount.level !== oldLevel;
    const levelInfo = this.configManager.getLevel(freshAccount.level)!;
    const benefits = this.configManager.getBenefitPackages(freshAccount.level);
    const privileges = Array.from(new Set(benefits.flatMap(b => b.privileges)));
    const memberInfo = await this.memberManager.getMemberInfo(memberId);

    await this.logger.log({
      memberId,
      action: 'place_order',
      module: 'order',
      detail: { orderId, orderAmount, pointsEarned, growthEarned, levelChanged, newLevel: freshAccount.level, oldLevel },
    });

    return {
      success: true, orderId, orderAmount, pointsEarned, pointsRate, growthEarned, growthRate,
      totalPoints: freshAccount.points, totalGrowth: freshAccount.totalGrowth,
      currentLevel: freshAccount.level, currentLevelName: levelInfo.name, levelChanged,
      oldLevel: levelChanged ? oldLevel : undefined, newLevel: levelChanged ? freshAccount.level : undefined,
      levelUpRewards, benefits, privileges, memberInfo,
    };
  }

  async refundOrder(memberId: string, orderId: string, orderAmount: number): Promise<RefundOrderResult> {
    const account = await this.storage.getMember(memberId);
    const defaultLevel = this.configManager.getDefaultLevel();
    if (!account) {
      return {
        success: false, orderId, orderAmount, pointsDeducted: 0, growthDeducted: 0,
        totalPoints: 0, totalGrowth: 0, levelChanged: false,
        currentLevel: defaultLevel, currentLevelName: this.configManager.getLevel(defaultLevel)?.name || '',
        couponsRevoked: [], couponsRevokedCount: 0, benefits: [], privileges: [], memberInfo: null,
      };
    }

    const orderPointRecords = await this.getPointRecordsByBizId(orderId);
    const orderGrowthRecords = await this.getGrowthRecordsByBizId(orderId);

    let pointsDeducted = 0;
    for (const pr of orderPointRecords) {
      if (pr.type === 'earn' && pr.source === 'order') {
        pointsDeducted += pr.amount;
      }
    }

    let growthDeducted = 0;
    for (const gr of orderGrowthRecords) {
      if (gr.source === 'order') {
        growthDeducted += gr.amount;
      }
    }

    if (pointsDeducted > 0) {
      const actualDeduction = Math.min(pointsDeducted, account.points);
      if (actualDeduction > 0) {
        await this.pointManager.spend(memberId, actualDeduction, 'refund', {
          bizId: orderId,
          remark: `退款订单 ${orderId}，扣除积分`,
        });
      }
    }

    if (growthDeducted > 0) {
      const actualGrowthDeduction = Math.min(growthDeducted, account.growth);
      if (actualGrowthDeduction > 0) {
        account.growth -= actualGrowthDeduction;
      }
    }

    const oldLevel = account.level;
    if (growthDeducted > 0) {
      const newLevelInfo = this.configManager.getLevelByGrowth(account.growth);
      account.level = newLevelInfo.level;
    }

    const couponsRevoked: Coupon[] = [];
    const allCouponsResult = this.storage.getCoupons(memberId);
    const allCoupons: Coupon[] = allCouponsResult instanceof Promise ? await allCouponsResult : allCouponsResult;
    for (const coupon of allCoupons) {
      if (coupon.source && (coupon.source.includes('升级') || coupon.source.includes('Lv.'))) {
        if (coupon.status === 'unused') {
          await this.storage.updateCoupon(coupon.id, {
            status: 'revoked',
            revokeReason: `退款订单 ${orderId}，等级变更回收`,
          });
          const updatedCoupon = (this.storage as any).getCouponById
            ? await (this.storage as any).getCouponById(coupon.id)
            : coupon;
          if (updatedCoupon) couponsRevoked.push(updatedCoupon);
        }
      }
    }

    await this.storage.saveMember(account);

    const freshAccount = await this.storage.getMember(memberId);
    const levelChanged = oldLevel !== freshAccount!.level;
    const levelInfo = this.configManager.getLevel(freshAccount!.level)!;
    const benefits = this.configManager.getBenefitPackages(freshAccount!.level);
    const privileges = Array.from(new Set(benefits.flatMap(b => b.privileges)));
    const memberInfo = await this.memberManager.getMemberInfo(memberId);

    await this.logger.log({
      memberId,
      action: 'refund_order',
      module: 'order',
      detail: { orderId, orderAmount, pointsDeducted, growthDeducted, levelChanged, oldLevel, newLevel: freshAccount!.level, couponsRevoked: couponsRevoked.map(c => c.id) },
    });

    return {
      success: true, orderId, orderAmount, pointsDeducted, growthDeducted,
      totalPoints: freshAccount!.points, totalGrowth: freshAccount!.totalGrowth,
      levelChanged, oldLevel: levelChanged ? oldLevel : undefined, newLevel: levelChanged ? freshAccount!.level : undefined,
      currentLevel: freshAccount!.level, currentLevelName: levelInfo.name,
      couponsRevoked, couponsRevokedCount: couponsRevoked.length,
      benefits, privileges, memberInfo,
    };
  }

  async triggerBirthdayReward(memberId: string): Promise<BirthdayRewardResult> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return { success: false, alreadyRewarded: false, totalPoints: 0, currentLevel: this.configManager.getDefaultLevel() };
    }

    const birthday = account.profile.birthday;
    if (!birthday || !isBirthday(birthday)) {
      return { success: false, alreadyRewarded: false, totalPoints: account.points, currentLevel: account.level };
    }

    const currentYear = getCurrentYear();
    if (account.lastBirthdayRewardYear === currentYear) {
      return { success: false, alreadyRewarded: true, totalPoints: account.points, currentLevel: account.level };
    }

    const config = this.configManager.getConfig();
    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (config.birthdayRewardPoints) {
      const pointsResult = await this.pointManager.earn(memberId, config.birthdayRewardPoints, 'birthday', { remark: '生日奖励' });
      earnedPoints = pointsResult.points;
    }
    if (config.birthdayRewardGrowth) {
      const growthResult = await this.growthManager.add(memberId, config.birthdayRewardGrowth, 'birthday', { remark: '生日奖励' });
      earnedGrowth = growthResult.growth;
    }
    if (config.birthdayRewardCouponTemplateId) {
      const couponResult = await this.issueCoupon(memberId, config.birthdayRewardCouponTemplateId, '生日奖励');
      coupon = couponResult.coupon;
    }

    account.lastBirthdayRewardYear = currentYear;
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId, action: 'birthday_reward', module: 'reward',
      detail: { points: earnedPoints, growth: earnedGrowth, year: currentYear },
    });

    return { success: true, alreadyRewarded: false, points: earnedPoints, growth: earnedGrowth, coupon, totalPoints: account.points, currentLevel: account.level };
  }

  async completeTask(memberId: string, taskId: string): Promise<CompleteTaskResult> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return { success: false, alreadyCompleted: false, totalPoints: 0, currentLevel: this.configManager.getDefaultLevel() };
    }

    const task = this.configManager.getTask(taskId);
    if (!task) {
      return { success: false, alreadyCompleted: false, totalPoints: account.points, currentLevel: account.level };
    }

    let taskRecord = await this.storage.getTaskRecord(memberId, taskId);
    const now = Date.now();

    if (taskRecord) {
      if (task.type === 'once' && taskRecord.completed) {
        return { success: false, alreadyCompleted: true, totalPoints: account.points, currentLevel: account.level };
      }
      if (task.type === 'daily') {
        if (taskRecord.completed && isSameDay(taskRecord.completeTime!, now)) {
          return { success: false, alreadyCompleted: true, totalPoints: account.points, currentLevel: account.level };
        }
        if (!isSameDay(taskRecord.lastResetTime, now)) {
          taskRecord.completed = false;
          taskRecord.lastResetTime = now;
        }
      }
      if (task.type === 'weekly') {
        if (taskRecord.completed && isSameWeek(taskRecord.completeTime!, now)) {
          return { success: false, alreadyCompleted: true, totalPoints: account.points, currentLevel: account.level };
        }
        if (!isSameWeek(taskRecord.lastResetTime, now)) {
          taskRecord.completed = false;
          taskRecord.lastResetTime = now;
        }
      }
    } else {
      taskRecord = { memberId, taskId, completed: false, lastResetTime: now };
    }

    taskRecord.completed = true;
    taskRecord.completeTime = now;

    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (task.points) {
      const pointsResult = await this.pointManager.earn(memberId, task.points, 'task', { bizId: taskId, remark: `完成任务：${task.name}` });
      earnedPoints = pointsResult.points;
    }
    if (task.growth) {
      const growthResult = await this.growthManager.add(memberId, task.growth, 'task', { bizId: taskId, remark: `完成任务：${task.name}` });
      earnedGrowth = growthResult.growth;
    }
    if (task.couponTemplateId) {
      const couponResult = await this.issueCoupon(memberId, task.couponTemplateId, `任务：${task.name}`);
      coupon = couponResult.coupon;
    }

    await this.storage.saveTaskRecord(taskRecord);
    await this.logger.log({
      memberId, action: 'complete_task', module: 'reward',
      detail: { taskId, taskName: task.name, points: earnedPoints, growth: earnedGrowth },
    });

    return { success: true, alreadyCompleted: false, points: earnedPoints, growth: earnedGrowth, coupon, totalPoints: account.points, currentLevel: account.level };
  }

  async issueLevelUpRewards(memberId: string, oldLevel: number, newLevel: number): Promise<Coupon[]> {
    const rewards: Coupon[] = [];
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      const benefit = this.configManager.getBenefitPackage(level);
      if (benefit?.couponTemplates) {
        for (const templateId of benefit.couponTemplates) {
          const result = await this.issueCoupon(memberId, templateId, `升级到Lv.${level}奖励`);
          rewards.push(result.coupon);
        }
      }
    }
    return rewards;
  }

  async getExpiringCoupons(memberId: string, days: number = 7): Promise<CouponWithExpireInfo[]> {
    const result = this.storage.getCoupons(memberId, 'unused');
    const coupons: Coupon[] = result instanceof Promise ? await result : result;
    const threshold = addDays(Date.now(), days);
    const now = Date.now();
    return coupons
      .filter(c => c.expireTime <= threshold && c.expireTime >= now)
      .sort((a, b) => a.expireTime - b.expireTime)
      .map(c => ({ ...c, isExpiring: true, daysLeft: Math.ceil((c.expireTime - now) / 86400000) }));
  }
}
