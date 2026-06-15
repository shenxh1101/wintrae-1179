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
  status: 'unused' | 'used' | 'expired';
  createTime: number;
  expireTime: number;
  useTime?: number;
  orderId?: string;
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

export interface SignInConfig {
  cycleDays: number;
  rewards: SignInReward[];
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
  lastBirthdayRewardYear?: number;
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
  getCoupons(memberId: string, status?: 'unused' | 'used' | 'expired'): Promise<Coupon[]> | Coupon[];
  addCoupon(coupon: Coupon): Promise<void> | void;
  updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<void> | void;
  getTaskRecord(memberId: string, taskId: string): Promise<TaskRecord | null> | TaskRecord | null;
  saveTaskRecord(record: TaskRecord): Promise<void> | void;
  addOperationLog(log: OperationLog): Promise<void> | void;
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
  isContinuous: boolean;
  points?: number;
  growth?: number;
  coupon?: Coupon;
  totalPoints: number;
  currentLevel: number;
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
