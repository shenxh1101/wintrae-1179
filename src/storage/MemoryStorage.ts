import {
  MemberAccount,
  PointRecord,
  GrowthRecord,
  LevelChangeRecord,
  Coupon,
  TaskRecord,
  OperationLog,
  SignInDailyRecord,
  OrderSettlementRecord,
  StorageAdapter,
} from '../types';

export class MemoryStorage implements StorageAdapter {
  private members: Map<string, MemberAccount> = new Map();
  private pointRecords: Map<string, PointRecord[]> = new Map();
  private growthRecords: Map<string, GrowthRecord[]> = new Map();
  private levelChangeRecords: Map<string, LevelChangeRecord[]> = new Map();
  private coupons: Map<string, Coupon> = new Map();
  private memberCoupons: Map<string, string[]> = new Map();
  private taskRecords: Map<string, Map<string, TaskRecord>> = new Map();
  private operationLogs: OperationLog[] = [];
  private signInDailyRecords: Map<string, SignInDailyRecord[]> = new Map();
  private orderSettlementRecords: Map<string, OrderSettlementRecord[]> = new Map();

  getMember(memberId: string): MemberAccount | null {
    return this.members.get(memberId) || null;
  }

  saveMember(account: MemberAccount): void {
    this.members.set(account.memberId, account);
  }

  getPointRecords(memberId: string, limit?: number): PointRecord[] {
    const records = this.pointRecords.get(memberId) || [];
    const sorted = records.sort((a, b) => b.createTime - a.createTime);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  addPointRecord(record: PointRecord): void {
    if (!this.pointRecords.has(record.memberId)) {
      this.pointRecords.set(record.memberId, []);
    }
    this.pointRecords.get(record.memberId)!.push(record);
  }

  getPointRecordsByBizId(bizId: string): PointRecord[] {
    const all: PointRecord[] = [];
    for (const records of this.pointRecords.values()) {
      all.push(...records.filter(r => r.bizId === bizId));
    }
    return all.sort((a, b) => b.createTime - a.createTime);
  }

  getGrowthRecords(memberId: string, limit?: number): GrowthRecord[] {
    const records = this.growthRecords.get(memberId) || [];
    const sorted = records.sort((a, b) => b.createTime - a.createTime);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  addGrowthRecord(record: GrowthRecord): void {
    if (!this.growthRecords.has(record.memberId)) {
      this.growthRecords.set(record.memberId, []);
    }
    this.growthRecords.get(record.memberId)!.push(record);
  }

  getGrowthRecordsByBizId(bizId: string): GrowthRecord[] {
    const all: GrowthRecord[] = [];
    for (const records of this.growthRecords.values()) {
      all.push(...records.filter(r => r.bizId === bizId));
    }
    return all.sort((a, b) => b.createTime - a.createTime);
  }

  getLevelChangeRecords(memberId: string, limit?: number): LevelChangeRecord[] {
    const records = this.levelChangeRecords.get(memberId) || [];
    const sorted = records.sort((a, b) => b.createTime - a.createTime);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  addLevelChangeRecord(record: LevelChangeRecord): void {
    if (!this.levelChangeRecords.has(record.memberId)) {
      this.levelChangeRecords.set(record.memberId, []);
    }
    this.levelChangeRecords.get(record.memberId)!.push(record);
  }

  getCoupons(memberId: string, status?: 'unused' | 'used' | 'expired' | 'revoked'): Coupon[] {
    const couponIds = this.memberCoupons.get(memberId) || [];
    const coupons = couponIds.map(id => this.coupons.get(id)!).filter(Boolean);
    if (status) {
      return coupons.filter(c => c.status === status);
    }
    return coupons;
  }

  getCouponById(couponId: string): Coupon | null {
    return this.coupons.get(couponId) || null;
  }

  addCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.id, coupon);
    if (!this.memberCoupons.has(coupon.memberId)) {
      this.memberCoupons.set(coupon.memberId, []);
    }
    this.memberCoupons.get(coupon.memberId)!.push(coupon.id);
  }

  updateCoupon(couponId: string, updates: Partial<Coupon>): void {
    const coupon = this.coupons.get(couponId);
    if (coupon) {
      this.coupons.set(couponId, { ...coupon, ...updates });
    }
  }

  getTaskRecord(memberId: string, taskId: string): TaskRecord | null {
    const memberTasks = this.taskRecords.get(memberId);
    return memberTasks?.get(taskId) || null;
  }

  saveTaskRecord(record: TaskRecord): void {
    if (!this.taskRecords.has(record.memberId)) {
      this.taskRecords.set(record.memberId, new Map());
    }
    this.taskRecords.get(record.memberId)!.set(record.taskId, record);
  }

  addOperationLog(log: OperationLog): void {
    this.operationLogs.push(log);
  }

  getOperationLogs(memberId?: string, limit?: number): OperationLog[] {
    let logs = this.operationLogs;
    if (memberId) {
      logs = logs.filter(l => l.memberId === memberId);
    }
    const sorted = logs.sort((a, b) => b.createTime - a.createTime);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  addSignInDailyRecord(record: SignInDailyRecord): void {
    if (!this.signInDailyRecords.has(record.memberId)) {
      this.signInDailyRecords.set(record.memberId, []);
    }
    this.signInDailyRecords.get(record.memberId)!.push(record);
  }

  getSignInDailyRecords(memberId: string, startDate?: string, endDate?: string): SignInDailyRecord[] {
    const records = this.signInDailyRecords.get(memberId) || [];
    let filtered = records;
    if (startDate) {
      filtered = filtered.filter(r => r.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.date <= endDate);
    }
    return filtered.sort((a, b) => a.date.localeCompare(b.date) || a.createTime - b.createTime);
  }

  getCouponsBySource(memberId: string, source: string): Coupon[] {
    const couponIds = this.memberCoupons.get(memberId) || [];
    const coupons = couponIds.map(id => this.coupons.get(id)!).filter(Boolean);
    return coupons.filter(c => c.source === source);
  }

  getPointRecordsBySource(memberId: string, source: string): PointRecord[] {
    const records = this.pointRecords.get(memberId) || [];
    return records.filter(r => r.source === source).sort((a, b) => b.createTime - a.createTime);
  }

  getGrowthRecordsBySource(memberId: string, source: string): GrowthRecord[] {
    const records = this.growthRecords.get(memberId) || [];
    return records.filter(r => r.source === source).sort((a, b) => b.createTime - a.createTime);
  }

  addOrderSettlementRecord(record: OrderSettlementRecord): void {
    if (!this.orderSettlementRecords.has(record.memberId)) {
      this.orderSettlementRecords.set(record.memberId, []);
    }
    this.orderSettlementRecords.get(record.memberId)!.push(record);
  }

  getOrderSettlementRecords(memberId: string, orderId?: string): OrderSettlementRecord[] {
    const records = this.orderSettlementRecords.get(memberId) || [];
    let filtered = records;
    if (orderId) {
      filtered = filtered.filter(r => r.orderId === orderId);
    }
    return filtered.sort((a, b) => b.createTime - a.createTime);
  }

  getOrderSettlementSummary(memberId: string, orderId: string): {
    pointsEarned: number;
    pointsRefunded: number;
    pointsRemaining: number;
    growthEarned: number;
    growthRefunded: number;
    growthRemaining: number;
    refundAmountTotal: number;
  } {
    const records = this.getOrderSettlementRecords(memberId, orderId);
    if (records.length === 0) {
      return {
        pointsEarned: 0, pointsRefunded: 0, pointsRemaining: 0,
        growthEarned: 0, growthRefunded: 0, growthRemaining: 0,
        refundAmountTotal: 0,
      };
    }
    const first = records[records.length - 1];
    const pointsRefunded = records.reduce((sum, r) => sum + (r.pointsRefunded - 0), 0);
    const growthRefunded = records.reduce((sum, r) => sum + (r.growthRefunded - 0), 0);
    const refundAmountTotal = records.reduce((sum, r) => sum + r.refundAmount, 0);
    return {
      pointsEarned: first.pointsEarned,
      pointsRefunded,
      pointsRemaining: first.pointsEarned - pointsRefunded,
      growthEarned: first.growthEarned,
      growthRefunded,
      growthRemaining: first.growthEarned - growthRefunded,
      refundAmountTotal,
    };
  }
}
