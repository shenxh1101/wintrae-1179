import { MemberGrowthSDK, SDKConfig, MemberProfile } from '../index';

function createTestSDK(): MemberGrowthSDK {
  const config: SDKConfig = {
    appId: 'test-app',
    levels: [
      { level: 1, name: '普通', minGrowth: 0 },
      { level: 2, name: '白银', minGrowth: 100 },
      { level: 3, name: '黄金', minGrowth: 500 },
      { level: 4, name: '铂金', minGrowth: 2000 },
    ],
    couponTemplates: [
      { id: 'ct_test', name: '测试券10元', type: 'cash', value: 10, validDays: 30 },
      { id: 'ct_discount', name: '9折券', type: 'discount', value: 0.9, validDays: 15 },
      { id: 'ct_platinum', name: '铂金专属券', type: 'cash', value: 50, validDays: 30 },
    ],
    benefitPackages: [
      { id: 'bp_2', level: 2, name: '白银包', description: '', couponTemplates: ['ct_discount'], privileges: ['专属客服'] },
      { id: 'bp_3', level: 3, name: '黄金包', description: '', couponTemplates: ['ct_test', 'ct_discount'], privileges: ['专属客服', '免费包邮'] },
      { id: 'bp_4', level: 4, name: '铂金包', description: '', couponTemplates: ['ct_test', 'ct_discount', 'ct_platinum'], privileges: ['专属客服', '免费包邮', 'VIP通道'] },
    ],
    signInConfig: {
      cycleDays: 3,
      rewards: [
        { day: 1, points: 10, growth: 2 },
        { day: 2, points: 15, growth: 3 },
        { day: 3, points: 20, growth: 5, couponTemplateId: 'ct_test' },
      ],
      makeupConfig: {
        maxMakeupCount: 5,
        makeupCostPoints: 30,
        makeupWindowDays: 7,
      },
    },
    tasks: [
      { id: 't1', name: '测试一次性任务', description: '', type: 'once', points: 100 },
    ],
    birthdayRewardPoints: 88,
    orderPointRate: 2,
    orderGrowthRate: 1,
  };
  return new MemberGrowthSDK(config);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

async function runTests(): Promise<void> {
  console.log('========== SDK v5 增强功能测试 ==========\n');

  console.log('【1. 订单逆向结算 — 幂等 + 剩余额度测试】');
  const sdk1 = createTestSDK();
  const mid1 = 'test_idempotent_refund';
  await sdk1.register({ memberId: mid1, nickname: '幂等退款', registerTime: Date.now() });

  const order1 = await sdk1.placeOrder(mid1, 500, 'idem_order_001');
  assert(order1.success === true, '下单成功');
  assert(order1.pointsEarned === 1000, '获得1000积分');
  assert(order1.growthEarned === 500, '获得500成长值');
  assert(order1.levelChanged === true, '触发升级');
  assert(order1.newLevel === 3, '升到Lv.3');
  assert(order1.levelUpRewards.length >= 2, '获得>=2张升级奖励券');

  const partial1 = await sdk1.partialRefund(mid1, 'idem_order_001', 500, 200);
  assert(partial1.success === true, '第一次部分退款成功');
  assert(partial1.refundType === 'partial_refund', '类型=partial_refund');
  assert(partial1.pointsDeducted === 400, '本次扣400积分(200/500*1000)');
  assert(partial1.growthDeducted === 200, '本次扣200成长值');
  assert(partial1.pointsEarnedTotal === 1000, '总获得积分=1000');
  assert(partial1.pointsRefundedTotal === 400, '已退积分=400');
  assert(partial1.pointsRemaining === 600, '剩余可退积分=600');
  assert(partial1.growthRemaining === 300, '剩余可退成长值=300');
  assert(partial1.settlementId !== '', '返回结算ID');

  const partial2 = await sdk1.partialRefund(mid1, 'idem_order_001', 500, 150);
  assert(partial2.success === true, '第二次部分退款成功');
  assert(partial2.pointsDeducted === 300, '本次扣300积分(150/500*1000)');
  assert(partial2.pointsRefundedTotal === 700, '累计已退700积分');
  assert(partial2.pointsRemaining === 300, '剩余可退300积分');
  assert(partial2.growthRefundedTotal === 350, '累计已退350成长值');
  assert(partial2.refundAmountTotal === 350, '累计退款350元');

  const refundAll = await sdk1.refundOrder(mid1, 'idem_order_001', 500);
  assert(refundAll.success === true, '整单退款成功');
  assert(refundAll.pointsDeducted === 300, '本次扣剩余300积分');
  assert(refundAll.pointsRefundedTotal === 1000, '累计已退=总获得=1000');
  assert(refundAll.pointsRemaining === 0, '剩余可退=0');
  assert(refundAll.growthRemaining === 0, '剩余可退成长值=0');
  assert(refundAll.refundAmountTotal === 500, '累计退款=订单金额');

  const repeatRefund = await sdk1.refundOrder(mid1, 'idem_order_001', 500);
  assert(repeatRefund.success === true, '重复退款调用成功');
  assert(repeatRefund.pointsDeducted === 0, '重复退款扣0积分');
  assert(repeatRefund.growthDeducted === 0, '重复退款扣0成长值');
  assert(repeatRefund.pointsRemaining === 0, '剩余可退仍为0');

  const infoAfter = await sdk1.getMemberInfo(mid1);
  assert(infoAfter!.points === refundAll.snapshot.points, '退款后查询积分=快照积分');
  assert(infoAfter!.growth === refundAll.snapshot.growth, '退款后查询成长值=快照成长值');
  assert(infoAfter!.level === refundAll.currentLevel, '退款后等级一致');
  console.log();

  console.log('【2. 等级区间精确回收券测试】');
  const sdk2 = createTestSDK();
  const mid2 = 'test_level_precise_revoke';
  await sdk2.register({ memberId: mid2, nickname: '精确回收', registerTime: Date.now() });

  const order2 = await sdk2.placeOrder(mid2, 1000, 'precise_order_001');
  assert(order2.success === true, '下单成功');
  assert(order2.newLevel === 3, '升到Lv.3（1000成长值）');
  assert(order2.levelUpRewards.length >= 2, '获得>=2张升级奖励券（Lv2+Lv3）');

  const couponsAfterOrder = await sdk2.getCouponList(mid2);
  assert(couponsAfterOrder.unusedCount >= 2, '有>=2张可用券');

  const partial2_1 = await sdk2.partialRefund(mid2, 'precise_order_001', 1000, 300);
  assert(partial2_1.success === true, '部分退款300成功');
  assert(partial2_1.levelChanged === false, '退300元不降级');
  assert(partial2_1.couponsRevokedCount === 0, '不降级时不回收券');
  assert(partial2_1.couponsKeptCount >= 2, '保留>=2张券');

  const partial2_2 = await sdk2.partialRefund(mid2, 'precise_order_001', 1000, 500);
  assert(partial2_2.success === true, '再退500元');
  assert(partial2_2.levelChanged === true, '触发降级');
  assert(partial2_2.oldLevel === 3, '从Lv.3降');
  assert(partial2_2.newLevel === 2, '降到Lv.2');
  assert(partial2_2.couponsRevokedCount >= 1, '回收>=1张Lv.3的券');
  assert(partial2_2.couponsKeptCount >= 1, '保留>=1张Lv.2的券');

  const revokedLv3 = partial2_2.couponsRevoked.filter(c => c.source && c.source.includes('Lv.3'));
  const keptLv2 = partial2_2.couponsKept.filter(c => {
    const src = c.source || '';
    return src.includes('Lv.2');
  });
  assert(revokedLv3.length >= 1, '回收的是Lv.3的券');
  assert(keptLv2.length >= 1, '保留的是Lv.2的券');

  const refund2 = await sdk2.refundOrder(mid2, 'precise_order_001', 1000);
  assert(refund2.success === true, '整单退完');
  assert(refund2.currentLevel === 1, '降回Lv.1');
  assert(refund2.couponsRevokedCount >= 1, '再回收>=1张券');
  console.log();

  console.log('【3. 取消订单测试】');
  const sdk3 = createTestSDK();
  const mid3 = 'test_cancel';
  await sdk3.register({ memberId: mid3, nickname: '取消订单', registerTime: Date.now() });

  await sdk3.placeOrder(mid3, 400, 'cancel_order_001');
  const cancel1 = await sdk3.cancelOrder(mid3, 'cancel_order_001', 400);
  assert(cancel1.success === true, '取消订单成功');
  assert(cancel1.refundType === 'cancel_order', '类型=cancel_order');
  assert(cancel1.pointsDeducted === 800, '扣除800积分');
  assert(cancel1.growthDeducted === 400, '扣除400成长值');
  assert(cancel1.pointsRemaining === 0, '剩余可退=0');
  assert(cancel1.levelChanged === true, '等级变化');
  assert(cancel1.couponsRevokedCount >= 1, '回收升级券');
  assert(cancel1.snapshot.level === 1, '快照等级=1');

  const cancelEvents = await sdk3.getMemberEvents(mid3, { types: ['cancel_order'] });
  assert(cancelEvents.total === 1, 'cancel_order事件1条');
  assert(cancelEvents.list[0].pointsChange < 0, '积分变化为负');
  console.log();

  console.log('【4. 订单轨迹查询测试】');
  const sdk4 = createTestSDK();
  const mid4 = 'test_order_trail';
  await sdk4.register({ memberId: mid4, nickname: '订单轨迹', registerTime: Date.now() });

  await sdk4.placeOrder(mid4, 600, 'trail_order_001');
  await sdk4.partialRefund(mid4, 'trail_order_001', 600, 200);
  await sdk4.partialRefund(mid4, 'trail_order_001', 600, 200);

  const trail = await sdk4.getOrderTrail(mid4, 'trail_order_001');
  assert(trail.orderId === 'trail_order_001', '订单号正确');
  assert(trail.orderAmount === 600, '订单金额正确');
  assert(trail.refundAmountTotal === 400, '累计退款400元');
  assert(trail.points.earned === 1200, '总获得积分=1200');
  assert(trail.points.refunded === 800, '已退积分=800');
  assert(trail.points.remaining === 400, '剩余积分=400');
  assert(trail.growth.earned === 600, '总获得成长值=600');
  assert(trail.growth.remaining === 200, '剩余成长值=200');
  assert(trail.events.length >= 3, '至少3条事件（下单+2次退款）');
  assert(trail.settlementRecords.length === 2, '2条结算记录');
  assert(trail.events[0].createTime >= trail.events[trail.events.length - 1].createTime, '事件按时间倒序');
  console.log();

  console.log('【5. 签到时间线稳定性测试】');
  const sdk5 = createTestSDK();
  const mid5 = 'test_timeline';
  await sdk5.register({ memberId: mid5, nickname: '时间线', registerTime: Date.now() });
  await sdk5.earnPoints(mid5, 500, 'test_fund');

  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const twoDaysAgo = new Date(today.getTime() - 86400000 * 2);
  const threeDaysAgo = new Date(today.getTime() - 86400000 * 3);

  const signToday = await sdk5.signIn(mid5);
  assert(signToday.success === true, '今天签到成功');
  assert(signToday.day === 1, '今天是第1天');

  const status1 = await sdk5.getSignInStatus(mid5);
  const calToday1 = status1.calendar.find(c => c.date === today.toISOString().slice(0, 10));
  assert(calToday1 !== undefined, '日历有今天');
  assert(calToday1!.signedIn === true, '今天已签');
  assert(calToday1!.type === 'normal', '今天是normal');
  assert(calToday1!.dayInCycle === 1, '今天dayInCycle=1');
  assert(calToday1!.reward !== undefined, '今天有奖励');
  assert(calToday1!.reward!.points === 10, '今天奖励10积分');

  const makeupYesterday = await sdk5.makeupSignIn(mid5, yesterday.toISOString().slice(0, 10));
  assert(makeupYesterday.success === true, '补签昨天成功');
  assert(makeupYesterday.day === 2, '补签的是第2天');

  const status2 = await sdk5.getSignInStatus(mid5);
  const calYesterday2 = status2.calendar.find(c => c.date === yesterday.toISOString().slice(0, 10));
  assert(calYesterday2 !== undefined, '日历有昨天');
  assert(calYesterday2!.signedIn === true, '昨天已签');
  assert(calYesterday2!.type === 'makeup', '昨天是补签');
  assert(calYesterday2!.dayInCycle === 2, '昨天dayInCycle=2（补签是第2个签到日）');
  assert(calYesterday2!.reward !== undefined, '昨天有奖励');
  assert(calYesterday2!.reward!.points === 15, '昨天奖励15积分（第2天奖励）');

  const calToday2 = status2.calendar.find(c => c.date === today.toISOString().slice(0, 10));
  assert(calToday2!.dayInCycle === 1, '今天dayInCycle仍然是1（稳定不变）');
  assert(calToday2!.reward!.points === 10, '今天奖励仍然是10积分（稳定）');

  const makeup2DaysAgo = await sdk5.makeupSignIn(mid5, twoDaysAgo.toISOString().slice(0, 10));
  assert(makeup2DaysAgo.success === true, '补签前天成功');
  assert(makeup2DaysAgo.day === 3, '补签的是第3天');

  const status3 = await sdk5.getSignInStatus(mid5);
  const isSorted = status3.calendar.every((c, i, arr) => i === 0 || c.date >= arr[i - 1].date);
  assert(isSorted === true, '日历按日期正序排列，稳定一致');

  const signedDays = status3.calendar.filter(c => c.signedIn);
  assert(signedDays.length === 3, '3天已签');
  assert(status3.continuousSignInDays === 3, '连续3天');

  const makeup3DaysAgo = await sdk5.makeupSignIn(mid5, threeDaysAgo.toISOString().slice(0, 10));
  assert(makeup3DaysAgo.success === true, '补签大前天成功（跨轮）');
  assert(makeup3DaysAgo.cycle >= 2, '进入第2轮');

  const status4 = await sdk5.getSignInStatus(mid5);
  assert(status4.continuousSignInDays === 4, '连续4天');
  assert(status4.currentCycle >= 2, '当前在第2轮');

  const calToday4 = status4.calendar.find(c => c.date === today.toISOString().slice(0, 10));
  assert(calToday4!.dayInCycle === 1, '今天是第2轮第1天');

  const stillSorted = status4.calendar.every((c, i, arr) => i === 0 || c.date >= arr[i - 1].date);
  assert(stillSorted === true, '多次操作后日历顺序仍然稳定');
  assert(status4.calendar.length <= 3, '日历天数不超过cycleDays=3');
  console.log();

  console.log('【6. 流水组合筛选测试】');
  const sdk6 = createTestSDK();
  const mid6 = 'test_filter_v2';
  await sdk6.register({ memberId: mid6, nickname: '筛选V2', registerTime: Date.now() });

  await sdk6.placeOrder(mid6, 300, 'filter_order_1');
  await sdk6.placeOrder(mid6, 200, 'filter_order_2');
  await sdk6.earnPoints(mid6, 100, 'manual', { remark: '手动充值' });
  await sdk6.signIn(mid6);
  await sdk6.completeTask(mid6, 't1');

  const orderEvents = await sdk6.getMemberEvents(mid6, { source: 'order' });
  assert(orderEvents.total >= 2, '按source=order筛选到>=2条下单事件');

  const signInEvents = await sdk6.getMemberEvents(mid6, { types: ['sign_in'] });
  assert(signInEvents.total === 1, '按type=sign_in筛选到1条');

  const combined = await sdk6.getMemberEvents(mid6, { types: ['earn_points'], source: 'order' });
  assert(combined.total >= 2, '类型+来源组合筛选正确');

  const couponSourceEvents = await sdk6.getMemberEvents(mid6, { couponSource: '升级到Lv.3奖励' });
  assert(couponSourceEvents.total >= 1, '按券来源筛选到升级奖励券');

  const rewardSourceOrder = await sdk6.getMemberEvents(mid6, { rewardSource: 'order' });
  assert(rewardSourceOrder.total >= 2, '按奖励来源=order筛选到>=2条');

  const bizIdEvents = await sdk6.getMemberEvents(mid6, { bizId: 'filter_order_1' });
  assert(bizIdEvents.total >= 2, '按bizId筛选到>=2条');
  console.log();

  console.log('【7. 退款后数据一致性测试】');
  const sdk7 = createTestSDK();
  const mid7 = 'test_consistency_v2';
  await sdk7.register({ memberId: mid7, nickname: '一致性V2', registerTime: Date.now() });

  await sdk7.placeOrder(mid7, 800, 'consist_order_001');
  const refund7 = await sdk7.partialRefund(mid7, 'consist_order_001', 800, 300);

  const info7 = await sdk7.getMemberInfo(mid7);
  const couponList7 = await sdk7.getCouponList(mid7);
  const status7 = await sdk7.getSignInStatus(mid7);

  assert(info7!.level === refund7.snapshot.level, '等级一致');
  assert(info7!.levelName === refund7.snapshot.levelName, '等级名一致');
  assert(info7!.growth === refund7.snapshot.growth, '成长值一致');
  assert(info7!.totalGrowth === refund7.snapshot.totalGrowth, '累计成长值一致');
  assert(info7!.points === refund7.snapshot.points, '积分一致');
  assert(info7!.totalPointsEarned === refund7.snapshot.totalPointsEarned, '累计获得积分一致');
  assert(info7!.totalPointsSpent === refund7.snapshot.totalPointsSpent, '累计消耗积分一致');
  assert(couponList7.unusedCount === refund7.snapshot.unusedCouponCount, '可用券数一致');
  assert(couponList7.revokedCount === refund7.snapshot.revokedCouponCount, '回收券数一致');
  assert(status7.todaySignedIn === refund7.snapshot.todaySignedIn, '今日签到状态一致');
  assert(status7.continuousSignInDays === refund7.snapshot.continuousSignInDays, '连续签到天数一致');
  assert(status7.totalSignInDays === refund7.snapshot.totalSignInDays, '总签到天数一致');
  console.log();

  console.log('【8. 基础功能回归测试】');
  const sdk8 = createTestSDK();
  const mid8 = 'regression_v5';
  const acc = await sdk8.register({ memberId: mid8, nickname: '回归V5', registerTime: Date.now() });
  assert(acc.memberId === mid8, '注册正常');

  const earn = await sdk8.earnPoints(mid8, 100, 'reg');
  assert(earn.success === true, '积分累计正常');

  const info = await sdk8.getMemberInfo(mid8);
  assert(info!.level === 1, '等级查询正常');

  const issued = await sdk8.issueCoupon(mid8, 'ct_test');
  assert(issued.success === true, '发券正常');

  const levels = sdk8.getLevels();
  assert(levels.length === 4, '等级配置正常');

  const eventsAll = await sdk8.getMemberEvents(mid8);
  assert(eventsAll.total >= 2, '事件流水正常');
  console.log();

  console.log('\n========== 测试结果 ==========');
  console.log(`通过: ${passed}  失败: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('测试运行出错:', e);
  process.exit(1);
});
