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
} from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { generateId, addDays, formatDate, isYesterday, isSameDay, isBirthday, getCurrentYear, isSameWeek } from '../utils';
import { Logger } from './Logger';
import { PointManager } from './PointManager';
import { GrowthManager } from './GrowthManager';

export class RewardManager {
  private storage: StorageAdapter;
  private configManager: ConfigManager;
  private logger: Logger;
  private pointManager: PointManager;
  private growthManager: GrowthManager;

  constructor(
    storage: StorageAdapter,
    configManager: ConfigManager,
    logger: Logger,
    pointManager: PointManager,
    growthManager: GrowthManager
  ) {
    this.storage = storage;
    this.configManager = configManager;
    this.logger = logger;
    this.pointManager = pointManager;
    this.growthManager = growthManager;
  }

  async issueCoupon(memberId: string, templateId: string): Promise<IssueCouponResult> {
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
    };

    await this.storage.addCoupon(coupon);
    await this.logger.log({
      memberId,
      action: 'issue_coupon',
      module: 'reward',
      detail: { couponId: coupon.id, templateId },
    });

    return { success: true, coupon };
  }

  async getCoupons(
    memberId: string,
    status?: 'unused' | 'used' | 'expired'
  ): Promise<Coupon[]> {
    return this.storage.getCoupons(memberId, status);
  }

  async useCoupon(couponId: string, orderId: string): Promise<boolean> {
    const coupons = await this.storage.getCoupons('');
    let targetCoupon: Coupon | undefined;
    for (const memberId of new Set(coupons.map(c => c.memberId))) {
      const memberCoupons = await this.storage.getCoupons(memberId);
      targetCoupon = memberCoupons.find(c => c.id === couponId);
      if (targetCoupon) break;
    }

    if (!targetCoupon) return false;
    if (targetCoupon.status !== 'unused') return false;
    if (targetCoupon.expireTime < Date.now()) return false;

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

  async signIn(memberId: string): Promise<SignInResult> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return {
        success: false,
        day: 0,
        isContinuous: false,
        totalPoints: 0,
        currentLevel: this.configManager.getDefaultLevel(),
      };
    }

    const today = formatDate(Date.now());
    if (account.lastSignInDate && isSameDay(new Date(account.lastSignInDate).getTime(), Date.now())) {
      return {
        success: false,
        day: account.continuousSignInDays,
        isContinuous: true,
        totalPoints: account.points,
        currentLevel: account.level,
      };
    }

    const signInConfig = this.configManager.getSignInConfig();
    const cycleDays = signInConfig?.cycleDays || 7;

    let isContinuous = false;
    if (account.lastSignInDate && isYesterday(new Date(account.lastSignInDate).getTime())) {
      isContinuous = true;
      account.continuousSignInDays = Math.min(account.continuousSignInDays + 1, cycleDays);
    } else {
      account.continuousSignInDays = 1;
    }

    account.lastSignInDate = today;
    account.totalSignInDays += 1;

    const day = account.continuousSignInDays;
    const rewardConfig = signInConfig?.rewards?.find(r => r.day === day);

    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (rewardConfig) {
      if (rewardConfig.points) {
        const pointsResult = await this.pointManager.earn(
          memberId,
          rewardConfig.points,
          'sign_in',
          { remark: `签到第 ${day} 天` }
        );
        earnedPoints = pointsResult.points;
      }
      if (rewardConfig.growth) {
        const growthResult = await this.growthManager.add(
          memberId,
          rewardConfig.growth,
          'sign_in',
          { remark: `签到第 ${day} 天` }
        );
        earnedGrowth = growthResult.growth;
      }
      if (rewardConfig.couponTemplateId) {
        const couponResult = await this.issueCoupon(memberId, rewardConfig.couponTemplateId);
        coupon = couponResult.coupon;
      }
    } else {
      const defaultPoints = 10;
      const pointsResult = await this.pointManager.earn(memberId, defaultPoints, 'sign_in', {
        remark: `签到第 ${day} 天`,
      });
      earnedPoints = pointsResult.points;
    }

    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'sign_in',
      module: 'reward',
      detail: { day, isContinuous, points: earnedPoints, growth: earnedGrowth },
    });

    return {
      success: true,
      day,
      isContinuous,
      points: earnedPoints,
      growth: earnedGrowth,
      coupon,
      totalPoints: account.points,
      currentLevel: account.level,
    };
  }

  async triggerBirthdayReward(memberId: string): Promise<BirthdayRewardResult> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return {
        success: false,
        alreadyRewarded: false,
        totalPoints: 0,
        currentLevel: this.configManager.getDefaultLevel(),
      };
    }

    const birthday = account.profile.birthday;
    if (!birthday || !isBirthday(birthday)) {
      return {
        success: false,
        alreadyRewarded: false,
        totalPoints: account.points,
        currentLevel: account.level,
      };
    }

    const currentYear = getCurrentYear();
    if (account.lastBirthdayRewardYear === currentYear) {
      return {
        success: false,
        alreadyRewarded: true,
        totalPoints: account.points,
        currentLevel: account.level,
      };
    }

    const config = this.configManager.getConfig();
    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (config.birthdayRewardPoints) {
      const pointsResult = await this.pointManager.earn(
        memberId,
        config.birthdayRewardPoints,
        'birthday',
        { remark: '生日奖励' }
      );
      earnedPoints = pointsResult.points;
    }

    if (config.birthdayRewardGrowth) {
      const growthResult = await this.growthManager.add(
        memberId,
        config.birthdayRewardGrowth,
        'birthday',
        { remark: '生日奖励' }
      );
      earnedGrowth = growthResult.growth;
    }

    if (config.birthdayRewardCouponTemplateId) {
      const couponResult = await this.issueCoupon(memberId, config.birthdayRewardCouponTemplateId);
      coupon = couponResult.coupon;
    }

    account.lastBirthdayRewardYear = currentYear;
    await this.storage.saveMember(account);
    await this.logger.log({
      memberId,
      action: 'birthday_reward',
      module: 'reward',
      detail: { points: earnedPoints, growth: earnedGrowth, year: currentYear },
    });

    return {
      success: true,
      alreadyRewarded: false,
      points: earnedPoints,
      growth: earnedGrowth,
      coupon,
      totalPoints: account.points,
      currentLevel: account.level,
    };
  }

  async completeTask(memberId: string, taskId: string): Promise<CompleteTaskResult> {
    const account = await this.storage.getMember(memberId);
    if (!account) {
      return {
        success: false,
        alreadyCompleted: false,
        totalPoints: 0,
        currentLevel: this.configManager.getDefaultLevel(),
      };
    }

    const task = this.configManager.getTask(taskId);
    if (!task) {
      return {
        success: false,
        alreadyCompleted: false,
        totalPoints: account.points,
        currentLevel: account.level,
      };
    }

    let taskRecord = await this.storage.getTaskRecord(memberId, taskId);
    const now = Date.now();

    if (taskRecord) {
      if (task.type === 'once' && taskRecord.completed) {
        return {
          success: false,
          alreadyCompleted: true,
          totalPoints: account.points,
          currentLevel: account.level,
        };
      }

      if (task.type === 'daily') {
        if (taskRecord.completed && isSameDay(taskRecord.completeTime!, now)) {
          return {
            success: false,
            alreadyCompleted: true,
            totalPoints: account.points,
            currentLevel: account.level,
          };
        }
        if (!isSameDay(taskRecord.lastResetTime, now)) {
          taskRecord.completed = false;
          taskRecord.lastResetTime = now;
        }
      }

      if (task.type === 'weekly') {
        if (taskRecord.completed && isSameWeek(taskRecord.completeTime!, now)) {
          return {
            success: false,
            alreadyCompleted: true,
            totalPoints: account.points,
            currentLevel: account.level,
          };
        }
        if (!isSameWeek(taskRecord.lastResetTime, now)) {
          taskRecord.completed = false;
          taskRecord.lastResetTime = now;
        }
      }
    } else {
      taskRecord = {
        memberId,
        taskId,
        completed: false,
        lastResetTime: now,
      };
    }

    taskRecord.completed = true;
    taskRecord.completeTime = now;

    let earnedPoints: number | undefined;
    let earnedGrowth: number | undefined;
    let coupon: Coupon | undefined;

    if (task.points) {
      const pointsResult = await this.pointManager.earn(memberId, task.points, 'task', {
        bizId: taskId,
        remark: `完成任务：${task.name}`,
      });
      earnedPoints = pointsResult.points;
    }

    if (task.growth) {
      const growthResult = await this.growthManager.add(memberId, task.growth, 'task', {
        bizId: taskId,
        remark: `完成任务：${task.name}`,
      });
      earnedGrowth = growthResult.growth;
    }

    if (task.couponTemplateId) {
      const couponResult = await this.issueCoupon(memberId, task.couponTemplateId);
      coupon = couponResult.coupon;
    }

    await this.storage.saveTaskRecord(taskRecord);
    await this.logger.log({
      memberId,
      action: 'complete_task',
      module: 'reward',
      detail: { taskId, taskName: task.name, points: earnedPoints, growth: earnedGrowth },
    });

    return {
      success: true,
      alreadyCompleted: false,
      points: earnedPoints,
      growth: earnedGrowth,
      coupon,
      totalPoints: account.points,
      currentLevel: account.level,
    };
  }

  async issueLevelUpRewards(memberId: string, oldLevel: number, newLevel: number): Promise<Coupon[]> {
    const rewards: Coupon[] = [];
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      const benefit = this.configManager.getBenefitPackage(level);
      if (benefit?.couponTemplates) {
        for (const templateId of benefit.couponTemplates) {
          const result = await this.issueCoupon(memberId, templateId);
          rewards.push(result.coupon);
        }
      }
    }
    return rewards;
  }

  async getExpiringCoupons(memberId: string, days: number = 7): Promise<Coupon[]> {
    const result = this.storage.getCoupons(memberId, 'unused');
    const coupons: Coupon[] = result instanceof Promise ? await result : result;
    const threshold = addDays(Date.now(), days);
    return coupons.filter(c => c.expireTime <= threshold && c.expireTime >= Date.now());
  }
}
