import { SDKConfig, MemberLevel, BenefitPackage, CouponTemplate, TaskConfig, SignInConfig } from '../types';

export class ConfigManager {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: SDKConfig): void {
    if (!config.appId) {
      throw new Error('[MemberGrowthSDK] appId is required');
    }
    if (!config.levels || config.levels.length === 0) {
      throw new Error('[MemberGrowthSDK] levels configuration is required');
    }
    const sortedLevels = [...config.levels].sort((a, b) => a.level - b.level);
    for (let i = 0; i < sortedLevels.length; i++) {
      const current = sortedLevels[i];
      const next = sortedLevels[i + 1];
      if (next && current.minGrowth >= next.minGrowth) {
        throw new Error(
          `[MemberGrowthSDK] Invalid level growth: level ${current.level} (${current.minGrowth}) >= level ${next.level} (${next.minGrowth})`
        );
      }
    }
  }

  getConfig(): SDKConfig {
    return this.config;
  }

  updateConfig(partialConfig: Partial<SDKConfig>): void {
    if (partialConfig.levels) {
      this.validateConfig({ ...this.config, ...partialConfig });
    }
    this.config = { ...this.config, ...partialConfig };
  }

  getLevels(): MemberLevel[] {
    return [...this.config.levels].sort((a, b) => a.level - b.level);
  }

  getLevel(level: number): MemberLevel | undefined {
    return this.config.levels.find(l => l.level === level);
  }

  getDefaultLevel(): number {
    if (this.config.defaultLevel !== undefined) {
      return this.config.defaultLevel;
    }
    return this.getLevels()[0]?.level ?? 1;
  }

  getLevelByGrowth(growth: number): MemberLevel {
    const sortedLevels = this.getLevels();
    let currentLevel = sortedLevels[0];
    for (const level of sortedLevels) {
      if (growth >= level.minGrowth) {
        currentLevel = level;
      } else {
        break;
      }
    }
    return currentLevel;
  }

  getNextLevel(level: number): MemberLevel | undefined {
    const sortedLevels = this.getLevels();
    const currentIndex = sortedLevels.findIndex(l => l.level === level);
    return currentIndex >= 0 && currentIndex < sortedLevels.length - 1
      ? sortedLevels[currentIndex + 1]
      : undefined;
  }

  getBenefitPackages(level?: number): BenefitPackage[] {
    const packages = this.config.benefitPackages || [];
    if (level === undefined) {
      return packages;
    }
    return packages.filter(p => p.level <= level);
  }

  getBenefitPackage(level: number): BenefitPackage | undefined {
    return this.config.benefitPackages?.find(p => p.level === level);
  }

  getCouponTemplate(templateId: string): CouponTemplate | undefined {
    return this.config.couponTemplates?.find(t => t.id === templateId);
  }

  getSignInConfig(): SignInConfig | undefined {
    return this.config.signInConfig;
  }

  getTask(taskId: string): TaskConfig | undefined {
    return this.config.tasks?.find(t => t.id === taskId);
  }

  getTasks(): TaskConfig[] {
    return this.config.tasks || [];
  }

  getOrderPointRate(): number {
    return this.config.orderPointRate ?? 1;
  }

  getOrderGrowthRate(): number {
    return this.config.orderGrowthRate ?? 1;
  }
}
