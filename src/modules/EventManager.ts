import {
  StorageAdapter,
  MemberEvent,
  MemberEventList,
  MemberEventQuery,
  EventType,
  OperationLog,
  PointRecord,
  GrowthRecord,
  LevelChangeRecord,
  Coupon,
} from '../types';
import { generateId } from '../utils';

const EVENT_TITLE_MAP: Record<EventType, string> = {
  register: '会员注册',
  update_profile: '资料更新',
  earn_points: '获得积分',
  spend_points: '扣除积分',
  add_growth: '获得成长值',
  level_change: '等级变更',
  sign_in: '每日签到',
  makeup_sign_in: '补签',
  complete_task: '完成任务',
  birthday_reward: '生日奖励',
  issue_coupon: '发放优惠券',
  use_coupon: '使用优惠券',
  place_order: '下单消费',
};

export class EventManager {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async getMemberEvents(memberId: string, query: MemberEventQuery = {}): Promise<MemberEventList> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const types = query.types;
    const startTime = query.startTime;
    const endTime = query.endTime;

    const allEvents: MemberEvent[] = [];

    const rawLogs = (this.storage as any).getOperationLogs
      ? await (this.storage as any).getOperationLogs(memberId)
      : [];

    const pointResult = this.storage.getPointRecords(memberId);
    const growthResult = this.storage.getGrowthRecords(memberId);
    const levelResult = this.storage.getLevelChangeRecords(memberId);
    const [pointRecords, growthRecords, levelRecords] = await Promise.all([
      pointResult instanceof Promise ? await pointResult : pointResult,
      growthResult instanceof Promise ? await growthResult : growthResult,
      levelResult instanceof Promise ? await levelResult : levelResult,
    ]);

    for (const log of rawLogs) {
      const eventType = log.action as EventType;
      if (types && types.length > 0 && !types.includes(eventType)) continue;
      if (startTime && log.createTime < startTime) continue;
      if (endTime && log.createTime > endTime) continue;

      const event = this.buildEventFromLog(
        log,
        eventType,
        pointRecords,
        growthRecords,
        levelRecords
      );
      if (event) allEvents.push(event);
    }

    allEvents.sort((a, b) => b.createTime - a.createTime);

    const total = allEvents.length;
    const startIndex = (page - 1) * pageSize;
    const list = allEvents.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < total;

    return { list, total, page, pageSize, hasMore };
  }

  private buildEventFromLog(
    log: OperationLog,
    type: EventType,
    pointRecords: PointRecord[],
    growthRecords: GrowthRecord[],
    levelRecords: LevelChangeRecord[]
  ): MemberEvent | null {
    const title = EVENT_TITLE_MAP[type] || log.action;
    let description = '';
    let pointsChange = 0;
    let growthChange = 0;
    let levelBefore: number | undefined;
    let levelAfter: number | undefined;
    let couponId: string | undefined;
    let couponName: string | undefined;
    let bizId: string | undefined;

    const detail = log.detail || {};
    bizId = detail.bizId;

    switch (type) {
      case 'register':
        description = '完成会员注册';
        break;
      case 'update_profile':
        description = '更新会员资料';
        break;
      case 'earn_points':
        pointsChange = detail.points || 0;
        description = `通过「${detail.source || '活动'}」获得 ${pointsChange} 积分`;
        break;
      case 'spend_points':
        pointsChange = -(detail.points || 0);
        description = `扣减 ${-pointsChange} 积分（${detail.source || '使用'}）`;
        break;
      case 'add_growth':
        growthChange = detail.growth || 0;
        description = `通过「${detail.source || '活动'}」获得 ${growthChange} 成长值`;
        break;
      case 'level_change':
        levelBefore = detail.fromLevel;
        levelAfter = detail.toLevel;
        if (levelAfter !== undefined && levelBefore !== undefined && levelAfter > levelBefore) {
          description = `升级：Lv.${levelBefore} → Lv.${levelAfter}`;
        } else {
          description = `等级变更：Lv.${levelBefore ?? '-'} → Lv.${levelAfter ?? '-'}`;
        }
        break;
      case 'sign_in':
        pointsChange = detail.points || 0;
        growthChange = detail.growth || 0;
        description = `签到第 ${detail.day || 1} 天${pointsChange ? `，+${pointsChange}积分` : ''}${growthChange ? `，+${growthChange}成长值` : ''}`;
        break;
      case 'makeup_sign_in':
        pointsChange = detail.points || 0;
        growthChange = detail.growth || 0;
        description = `补签 ${detail.makeupDate || ''}${pointsChange ? `，+${pointsChange}积分` : ''}${growthChange ? `，+${growthChange}成长值` : ''}`;
        break;
      case 'complete_task':
        pointsChange = detail.points || 0;
        growthChange = detail.growth || 0;
        description = `完成任务「${detail.taskName || '未知任务'}」${pointsChange ? `，+${pointsChange}积分` : ''}${growthChange ? `，+${growthChange}成长值` : ''}`;
        break;
      case 'birthday_reward':
        pointsChange = detail.points || 0;
        growthChange = detail.growth || 0;
        description = `领取${detail.year || '本年'}生日奖励${pointsChange ? `，+${pointsChange}积分` : ''}${growthChange ? `，+${growthChange}成长值` : ''}`;
        break;
      case 'issue_coupon':
        couponId = detail.couponId;
        couponName = detail.couponName || '优惠券';
        description = `获得优惠券「${couponName}」`;
        break;
      case 'use_coupon':
        couponId = detail.couponId;
        description = `使用优惠券（订单号：${detail.orderId || '-'}）`;
        break;
      case 'place_order':
        pointsChange = detail.pointsEarned || 0;
        growthChange = detail.growthEarned || 0;
        bizId = detail.orderId;
        description = `下单消费 ¥${detail.orderAmount || 0}${pointsChange ? `，+${pointsChange}积分` : ''}${growthChange ? `，+${growthChange}成长值` : ''}${detail.levelChanged ? `，升级到Lv.${detail.newLevel}` : ''}`;
        break;
    }

    if (!description) {
      description = JSON.stringify(detail);
    }

    return {
      id: generateId('ev_'),
      memberId: log.memberId,
      type,
      title,
      description,
      pointsChange,
      growthChange,
      levelBefore,
      levelAfter,
      couponId,
      couponName,
      bizId,
      detail,
      createTime: log.createTime,
      createTimeFormatted: this.formatTime(log.createTime),
    };
  }

  private formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}
