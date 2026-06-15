import {
  MemberAccount,
  PointRecord,
  GrowthRecord,
  LevelChangeRecord,
  Coupon,
  TaskRecord,
  OperationLog,
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

  getCoupons(memberId: string, status?: 'unused' | 'used' | 'expired'): Coupon[] {
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
}
