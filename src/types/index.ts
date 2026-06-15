export interface MemberProfile {
  memberId: string;
  nickname?: string;
  avatar?: string;
  birthday?: string;
  registerTime: number;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export interface MemberLevel {
  level: number;
  name: string;
  minGrowth: number;
  maxGrowth?: number;
  icon?: string;
  color?: string;
}

export interface PointRecord {
  id: string;
  memberId: string;
  amount: number;
  type: 'earn' | 'spend';
  source: string;
  bizId?: string;
  remark?: string;
  createTime: number;
  expireTime?: number;
}

export interface GrowthRecord {
  id: string;
  memberId: string;
  amount: number;
  source: string;
  bizId?: string;
  remark?: string;
  createTime: number;
}

export interface LevelChangeRecord {
  id: string;
  memberId: string;
  fromLevel: number;
  toLevel: number;
  reason: string;
  createTime: number;
}

export interface Coupon {
  id: string;
  memberId: string;
  templateId: string;
  name: string;
  type: 'discount' | 'cash' | 'shipping';
  value: number;
  threshold?: number;
  status: 'unused' | 'used' | 'expired' | 'revoked';
  createTime: number;
  expireTime: number;
  useTime?: number;
  orderId?: string;
  source?: string;
  revokeReason?: string;
}

export interface CouponTemplate {
  id: string;
  name: string;
  type: 'discount' | 'cash' | 'shipping';
  value: number;
  threshold?: number;
  validDays: number;
  description?: string;
}

export interface BenefitPackage {
  id: string;
  level: number;
  name: string;
  description: string;
  couponTemplates?: string[];
  pointMultiplier?: number;
  privileges: string[];
}

export interface SignInReward {
  day: number;
  points?: number;
  growth?: number;
  couponTemplateId?: string;
}

export interface MakeupConfig {
  maxMakeupCount: number;
  makeupCostPoints?: number;
  makeupWindowDays?: number;
}

export interface SignInConfig {
  cycleDays: number;
  rewards: SignInReward[];
  makeupConfig?: MakeupConfig;
}

export interface SignInDailyRecord {
  id: string;
  memberId: string;
  date: string;
  type: 'normal' | 'makeup';
  dayInCycle: number;
  cycle: number;
  points?: number;
  growth?: number;
  couponId?: string;
  createTime: number;
}

export interface TaskConfig {
  id: string;
  name: string;
  description: string;
  type: 'once' | 'daily' | 'weekly';
  points?: number;
  growth?: number;
  couponTemplateId?: string;
}

export interface TaskRecord {
  memberId: string;
  taskId: string;
  completed: boolean;
  completeTime?: number;
  lastResetTime: number;
}

export interface OperationLog {
  id: string;
  memberId: string;
  action: string;
  module: string;
  detail: any;
  operator?: string;
  createTime: number;
}

export interface MemberAccount {
  memberId: string;
  profile: MemberProfile;
  level: number;
  growth: number;
  totalGrowth: number;
  points: number;
  totalPointsEarned: number;
  totalPointsSpent: number;
  lastSignInDate?: string;
  continuousSignInDays: number;
  totalSignInDays: number;
  signInCycle: number;
  makeupUsedCount: number;
  lastBirthdayRewardYear?: number;
}

export interface CouponWithExpireInfo extends Coupon {
  isExpiring: boolean;
  daysLeft: number;
}

export interface SDKConfig {
  appId: string;
  appSecret?: string;
  levels: MemberLevel[];
  benefitPackages?: BenefitPackage[];
  couponTemplates?: CouponTemplate[];
  signInConfig?: SignInConfig;
  tasks?: TaskConfig[];
  defaultLevel?: number;
  birthdayRewardPoints?: number;
  birthdayRewardGrowth?: number;
  birthdayRewardCouponTemplateId?: string;
  orderPointRate?: number;
  orderGrowthRate?: number;
  logCallback?: (log: OperationLog) => void | Promise<void>;
  storage?: StorageAdapter;
}

export interface StorageAdapter {
  getMember(memberId: string): Promise<MemberAccount | null> | MemberAccount | null;
  saveMember(account: MemberAccount): Promise<void> | void;
  getPointRecords(memberId: string, limit?: number): Promise<PointRecord[]> | PointRecord[];
  addPointRecord(record: PointRecord): Promise<void> | void;
  getGrowthRecords(memberId: string, limit?: number): Promise<GrowthRecord[]> | GrowthRecord[];
  addGrowthRecord(record: GrowthRecord): Promise<void> | void;
  getLevelChangeRecords(memberId: string, limit?: number): Promise<LevelChangeRecord[]> | LevelChangeRecord[];
  addLevelChangeRecord(record: LevelChangeRecord): Promise<void> | void;
  getCoupons(memberId: string, status?: 'unused' | 'used' | 'expired' | 'revoked'): Promise<Coupon[]> | Coupon[];
  getCouponById?(couponId: string): Promise<Coupon | null> | Coupon | null;
  addCoupon(coupon: Coupon): Promise<void> | void;
  updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<void> | void;
  getTaskRecord(memberId: string, taskId: string): Promise<TaskRecord | null> | TaskRecord | null;
  saveTaskRecord(record: TaskRecord): Promise<void> | void;
  addOperationLog(log: OperationLog): Promise<void> | void;
  getOperationLogs?(memberId?: string, limit?: number): Promise<OperationLog[]> | OperationLog[];
  addSignInDailyRecord?(record: SignInDailyRecord): Promise<void> | void;
  getSignInDailyRecords?(memberId: string, startDate?: string, endDate?: string): Promise<SignInDailyRecord[]> | SignInDailyRecord[];
  getPointRecordsByBizId?(bizId: string): Promise<PointRecord[]> | PointRecord[];
  getGrowthRecordsByBizId?(bizId: string): Promise<GrowthRecord[]> | GrowthRecord[];
}

export interface EarnPointsResult {
  success: boolean;
  points: number;
  totalPoints: number;
  recordId: string;
  levelChanged: boolean;
  newLevel?: number;
  rewards?: Coupon[];
}

export interface SpendPointsResult {
  success: boolean;
  points: number;
  remainingPoints: number;
  recordId: string;
}

export interface AddGrowthResult {
  success: boolean;
  growth: number;
  totalGrowth: number;
  currentLevel: number;
  levelChanged: boolean;
  oldLevel?: number;
  newLevel?: number;
  levelUpRewards?: Coupon[];
}

export interface SignInResult {
  success: boolean;
  day: number;
  cycle: number;
  isContinuous: boolean;
  isCycleComplete: boolean;
  isMakeup: boolean;
  points?: number;
  growth?: number;
  coupon?: Coupon;
  totalPoints: number;
  currentLevel: number;
  memberInfo?: MemberInfoResult | null;
}

export interface MakeupSignInResult extends SignInResult {
  makeupDate: string;
  makeupCost?: number;
  makeupRemaining?: number;
}

export interface SignInCalendarItem {
  date: string;
  signedIn: boolean;
  type: 'normal' | 'makeup' | 'none';
  dayInCycle: number;
  reward?: SignInReward;
  canMakeup: boolean;
}

export interface SignInStatus {
  todaySignedIn: boolean;
  continuousSignInDays: number;
  totalSignInDays: number;
  currentCycle: number;
  currentDay: number;
  cycleDays: number;
  cycleProgress: string;
  calendar: SignInCalendarItem[];
  currentRewards: SignInReward[];
  totalRewards: SignInReward[];
  expiringCoupons?: CouponWithExpireInfo[];
  makeupUsedCount: number;
  makeupMaxCount: number;
  makeupRemaining: number;
  makeupCostPoints: number;
  makeupWindowDays: number;
}

export interface PlaceOrderResult {
  success: boolean;
  orderId: string;
  orderAmount: number;
  pointsEarned: number;
  pointsRate: number;
  growthEarned: number;
  growthRate: number;
  totalPoints: number;
  totalGrowth: number;
  currentLevel: number;
  currentLevelName: string;
  levelChanged: boolean;
  oldLevel?: number;
  newLevel?: number;
  levelUpRewards: Coupon[];
  benefits: BenefitPackage[];
  privileges: string[];
  memberInfo: MemberInfoResult | null;
}

export interface RefundOrderResult {
  success: boolean;
  orderId: string;
  orderAmount: number;
  pointsDeducted: number;
  growthDeducted: number;
  totalPoints: number;
  totalGrowth: number;
  levelChanged: boolean;
  oldLevel?: number;
  newLevel?: number;
  currentLevel: number;
  currentLevelName: string;
  couponsRevoked: Coupon[];
  couponsRevokedCount: number;
  benefits: BenefitPackage[];
  privileges: string[];
  memberInfo: MemberInfoResult | null;
}

export interface CouponListResult {
  unused: CouponWithExpireInfo[];
  used: CouponWithExpireInfo[];
  expired: CouponWithExpireInfo[];
  revoked: CouponWithExpireInfo[];
  total: number;
  expiring: CouponWithExpireInfo[];
  expiringCount: number;
  unusedCount: number;
  usedCount: number;
  expiredCount: number;
  revokedCount: number;
}

export type EventType =
  | 'register'
  | 'update_profile'
  | 'earn_points'
  | 'spend_points'
  | 'add_growth'
  | 'level_change'
  | 'sign_in'
  | 'makeup_sign_in'
  | 'complete_task'
  | 'birthday_reward'
  | 'issue_coupon'
  | 'use_coupon'
  | 'place_order'
  | 'refund_order';

export interface MemberEvent {
  id: string;
  memberId: string;
  type: EventType;
  title: string;
  description: string;
  pointsChange: number;
  growthChange: number;
  levelBefore?: number;
  levelAfter?: number;
  couponId?: string;
  couponName?: string;
  bizId?: string;
  detail: any;
  createTime: number;
  createTimeFormatted: string;
}

export interface MemberEventQuery {
  types?: EventType[];
  startTime?: number;
  endTime?: number;
  page?: number;
  pageSize?: number;
  bizId?: string;
}

export interface MemberEventList {
  list: MemberEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CompleteTaskResult {
  success: boolean;
  alreadyCompleted: boolean;
  points?: number;
  growth?: number;
  coupon?: Coupon;
  totalPoints: number;
  currentLevel: number;
}

export interface BirthdayRewardResult {
  success: boolean;
  alreadyRewarded: boolean;
  points?: number;
  growth?: number;
  coupon?: Coupon;
  totalPoints: number;
  currentLevel: number;
}

export interface IssueCouponResult {
  success: boolean;
  coupon: Coupon;
}

export interface MemberInfoResult {
  profile: MemberProfile;
  level: number;
  levelName: string;
  levelInfo: MemberLevel;
  growth: number;
  totalGrowth: number;
  nextLevelGrowth?: number;
  points: number;
  totalPointsEarned: number;
  totalPointsSpent: number;
  benefits: BenefitPackage[];
  continuousSignInDays: number;
  totalSignInDays: number;
  todaySignedIn: boolean;
}
