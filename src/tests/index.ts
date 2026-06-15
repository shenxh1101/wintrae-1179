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
    ],
    benefitPackages: [
      { id: 'bp_2', level: 2, name: '白银包', description: '', couponTemplates: ['ct_discount'], privileges: ['专属客服'] },
      { id: 'bp_3', level: 3, name: '黄金包', description: '', couponTemplates: ['ct_test', 'ct_discount'], privileges: ['专属客服', '免费包邮'] },
    ],
    signInConfig: {
      cycleDays: 3,
      rewards: [
        { day: 1, points: 10, growth: 2 },
        { day: 2, points: 15, growth: 3 },
        { day: 3, points: 20, growth: 5, couponTemplateId: 'ct_test' },
      ],
      makeupConfig: {
        maxMakeupCount: 2,
        makeupCostPoints: 50,
        makeupWindowDays: 7,
      },
    },
    tasks: [
      { id: 't1', name: '测试一次性任务', description: '', type: 'once', points: 100 },
      { id: 't2', name: '测试每日任务', description: '', type: 'daily', points: 10 },
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
  console.log('========== SDK v4 增强功能测试 ==========\n');

  console.log('【1. 签到日历 + 补签不改今日状态测试】');
  const sdk1 = createTestSDK();
  const mid1 = 'test_signin_v4';
  await sdk1.register({ memberId: mid1, nickname: '签到V4', registerTime: Date.now() });

  await sdk1.earnPoints(mid1, 200, 'test_fund', { remark: '测试补签资金' });

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);

  const makeup1 = await sdk1.makeupSignIn(mid1, yesterday);
  assert(makeup1.success === true, '补签昨天成功');
  assert(makeup1.isMakeup === true, '标记为补签');
  assert(makeup1.makeupCost === 50, '补签扣了50积分');

  const statusBeforeToday = await sdk1.getSignInStatus(mid1);
  assert(statusBeforeToday.todaySignedIn === false, '补签昨天后今天还没签');
  assert(statusBeforeToday.makeupUsedCount === 1, '已用1次补签');
  assert(statusBeforeToday.makeupRemaining === 1, '补签剩余1次');

  const calYesterday = statusBeforeToday.calendar.find(c => c.date === yesterday);
  assert(calYesterday !== undefined, '日历中有昨天');
  assert(calYesterday!.signedIn === true, '昨天标记已签');
  assert(calYesterday!.type === 'makeup', '昨天是补签类型');
  assert(calYesterday!.signType === 'makeup', 'signType=makeup');
  assert(calYesterday!.signTime !== undefined, '有签到时间');
  assert(calYesterday!.cycle >= 1, '日历项有周期');

  const todayCalBefore = statusBeforeToday.calendar.find(c => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return c.date === todayStr;
  });
  assert(todayCalBefore !== undefined, '日历中有今天');
  assert(todayCalBefore!.signedIn === false, '今天还未签');
  assert(todayCalBefore!.type === 'none', '今天类型为none');

  const s1 = await sdk1.signIn(mid1, { returnMemberInfo: true });
  assert(s1.success === true, '今天签到成功');
  assert(s1.isMakeup === false, '正常签到不是补签');

  const statusAfterToday = await sdk1.getSignInStatus(mid1);
  assert(statusAfterToday.todaySignedIn === true, '签到后今天已签');

  const duplicateMakeup = await sdk1.makeupSignIn(mid1, yesterday);
  assert(duplicateMakeup.success === false, '重复补签同一天失败');

  const makeup2 = await sdk1.makeupSignIn(mid1, twoDaysAgo);
  assert(makeup2.success === true, '第二次补签成功');
  assert(makeup2.makeupRemaining === 0, '补签次数用完');

  const threeDaysAgo = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10);
  const makeupExhausted = await sdk1.makeupSignIn(mid1, threeDaysAgo);
  assert(makeupExhausted.success === false, '补签次数用完后失败');

  const statusFinal = await sdk1.getSignInStatus(mid1);
  const calTwoDaysAgo = statusFinal.calendar.find(c => c.date === twoDaysAgo);
  assert(calTwoDaysAgo !== undefined, '日历中有前天');
  assert(calTwoDaysAgo!.signedIn === true, '前天标记已签');
  assert(calTwoDaysAgo!.type === 'makeup', '前天是补签类型');
  console.log();

  console.log('【2. 整单退款反向结算测试】');
  const sdk2 = createTestSDK();
  const mid2 = 'test_full_refund';
  await sdk2.register({ memberId: mid2, nickname: '整单退款', registerTime: Date.now() });

  const order1 = await sdk2.placeOrder(mid2, 500, 'full_refund_order_001');
  assert(order1.success === true, '下单成功');
  assert(order1.pointsEarned === 1000, '获得1000积分');
  assert(order1.growthEarned === 500, '获得500成长值');
  assert(order1.levelChanged === true, '触发升级');
  assert(order1.newLevel === 3, '升到Lv.3');
  assert(order1.levelUpRewards.length >= 2, '获得升级奖励券');

  const refund1 = await sdk2.refundOrder(mid2, 'full_refund_order_001', 500);
  assert(refund1.success === true, '退款成功');
  assert(refund1.refundType === 'full_refund', '类型为整单退款');
  assert(refund1.refundAmount === 500, '退款金额=订单金额');
  assert(refund1.pointsDeducted === 1000, '扣除1000积分');
  assert(refund1.growthDeducted === 500, '扣除500成长值');
  assert(refund1.levelChanged === true, '等级变化');
  assert(refund1.oldLevel === 3, '从Lv.3降级');
  assert(refund1.currentLevel === 1, '降回Lv.1');
  assert(refund1.couponsRevokedCount >= 1, '回收升级券');
  assert(refund1.memberInfo !== null, '返回 memberInfo');
  assert(refund1.benefits.length === 0, 'Lv.1无权益');
  assert(refund1.snapshot !== undefined, '返回快照');
  assert(refund1.snapshot.level === 1, '快照等级=1');
  assert(refund1.snapshot.levelName === '普通', '快照等级名=普通');
  assert(refund1.snapshot.growth === 0, '快照成长值=0');
  assert(refund1.snapshot.revokedCouponCount >= 1, '快照有回收券');

  const infoAfterRefund = await sdk2.getMemberInfo(mid2);
  assert(infoAfterRefund!.level === refund1.snapshot.level, '查询等级=退款快照等级');
  assert(infoAfterRefund!.growth === refund1.snapshot.growth, '查询成长值=退款快照成长值');
  assert(infoAfterRefund!.points === refund1.snapshot.points, '查询积分=退款快照积分');

  const couponList = await sdk2.getCouponList(mid2);
  assert(couponList.revokedCount >= 1, '优惠券列表有 revoked 状态');
  assert(couponList.revoked.length >= 1, 'revoked 数组有内容');
  console.log();

  console.log('【3. 取消订单反向结算测试】');
  const sdk3 = createTestSDK();
  const mid3 = 'test_cancel_order';
  await sdk3.register({ memberId: mid3, nickname: '取消订单', registerTime: Date.now() });

  const order3 = await sdk3.placeOrder(mid3, 300, 'cancel_order_001');
  assert(order3.success === true, '下单成功');
  assert(order3.levelChanged === true, '触发升级');
  assert(order3.newLevel === 2, '升到Lv.2');

  const cancel1 = await sdk3.cancelOrder(mid3, 'cancel_order_001', 300);
  assert(cancel1.success === true, '取消订单成功');
  assert(cancel1.refundType === 'cancel_order', '类型为取消订单');
  assert(cancel1.refundAmount === 300, '退款金额=订单金额');
  assert(cancel1.pointsDeducted === 600, '扣除600积分');
  assert(cancel1.growthDeducted === 300, '扣除300成长值');
  assert(cancel1.levelChanged === true, '等级变化');
  assert(cancel1.currentLevel === 1, '降回Lv.1');
  assert(cancel1.snapshot.level === 1, '快照等级=1');

  const cancelEvents = await sdk3.getMemberEvents(mid3, { types: ['cancel_order'] });
  assert(cancelEvents.total === 1, '取消订单事件1条');
  assert(cancelEvents.list[0].type === 'cancel_order', '类型为cancel_order');
  assert(cancelEvents.list[0].pointsChange < 0, '积分变化为负');
  assert(cancelEvents.list[0].growthChange < 0, '成长值变化为负');
  console.log();

  console.log('【4. 部分退款反向结算测试】');
  const sdk4 = createTestSDK();
  const mid4 = 'test_partial_refund';
  await sdk4.register({ memberId: mid4, nickname: '部分退款', registerTime: Date.now() });

  const order4 = await sdk4.placeOrder(mid4, 500, 'partial_refund_order_001');
  assert(order4.success === true, '下单成功');
  assert(order4.pointsEarned === 1000, '获得1000积分');
  assert(order4.growthEarned === 500, '获得500成长值');
  assert(order4.levelChanged === true, '触发升级');
  assert(order4.newLevel === 3, '升到Lv.3');

  const partial1 = await sdk4.partialRefund(mid4, 'partial_refund_order_001', 500, 200);
  assert(partial1.success === true, '部分退款成功');
  assert(partial1.refundType === 'partial_refund', '类型为部分退款');
  assert(partial1.refundAmount === 200, '退款金额200');
  assert(partial1.orderAmount === 500, '原订单金额500');
  assert(partial1.pointsDeducted === 400, '按比例扣除400积分(200/500*1000)');
  assert(partial1.growthDeducted === 200, '按比例扣除200成长值(200/500*500)');

  const infoAfterPartial = await sdk4.getMemberInfo(mid4);
  assert(infoAfterPartial!.level === partial1.currentLevel, '查询等级=部分退款返回等级');
  assert(infoAfterPartial!.points === partial1.snapshot.points, '查询积分=部分退款快照积分');
  assert(infoAfterPartial!.growth === partial1.snapshot.growth, '查询成长值=部分退款快照成长值');

  const partialEvents = await sdk4.getMemberEvents(mid4, { types: ['partial_refund'] });
  assert(partialEvents.total === 1, '部分退款事件1条');
  assert(partialEvents.list[0].type === 'partial_refund', '类型为partial_refund');
  console.log();

  console.log('【5. 退款后数据一致性测试】');
  const sdk5 = createTestSDK();
  const mid5 = 'test_consistency';
  await sdk5.register({ memberId: mid5, nickname: '一致性', registerTime: Date.now() });

  await sdk5.placeOrder(mid5, 500, 'consist_order_001');
  const refund5 = await sdk5.refundOrder(mid5, 'consist_order_001', 500);

  const info5 = await sdk5.getMemberInfo(mid5);
  const couponList5 = await sdk5.getCouponList(mid5);

  assert(info5!.level === refund5.snapshot.level, '等级一致');
  assert(info5!.levelName === refund5.snapshot.levelName, '等级名一致');
  assert(info5!.growth === refund5.snapshot.growth, '成长值一致');
  assert(info5!.totalGrowth === refund5.snapshot.totalGrowth, '累计成长值一致');
  assert(info5!.points === refund5.snapshot.points, '积分一致');
  assert(info5!.totalPointsEarned === refund5.snapshot.totalPointsEarned, '累计获得积分一致');
  assert(info5!.totalPointsSpent === refund5.snapshot.totalPointsSpent, '累计消耗积分一致');
  assert(couponList5.unusedCount === refund5.snapshot.unusedCouponCount, '可用券数一致');
  assert(couponList5.revokedCount === refund5.snapshot.revokedCouponCount, '回收券数一致');
  console.log();

  console.log('【6. 流水反查 — 按订单号/来源/券来源/奖励来源筛选】');
  const sdk6 = createTestSDK();
  const mid6 = 'test_event_filter';
  await sdk6.register({ memberId: mid6, nickname: '流水筛选', registerTime: Date.now() });
  await sdk6.placeOrder(mid6, 300, 'filter_order_001');
  await sdk6.earnPoints(mid6, 50, 'manual', { bizId: 'filter_order_001' });

  const eventsByOrder = await sdk6.getEventsByBizId('filter_order_001');
  assert(eventsByOrder.total >= 2, '按订单号反查到>=2条事件');
  assert(eventsByOrder.list.every(e => e.bizId === 'filter_order_001'), '所有事件 bizId 匹配');

  const memberEventsWithBizId = await sdk6.getMemberEvents(mid6, { bizId: 'filter_order_001' });
  assert(memberEventsWithBizId.total >= 2, '会员流水按 bizId 过滤到>=2条');

  const signInEvents = await sdk6.getMemberEvents(mid6, { source: 'order' });
  assert(signInEvents.total >= 1, '按 source=order 筛选到>=1条');

  const signSourceEvents = await sdk6.getMemberEvents(mid6, { source: 'sign_in' });
  assert(signSourceEvents.total >= 0, '按 source=sign_in 筛选正常');

  const couponSourceEvents = await sdk6.getMemberEvents(mid6, { couponSource: '升级到Lv.2奖励' });
  assert(couponSourceEvents.total >= 1, '按券来源筛选到升级奖励券事件');

  const rewardSourceEvents = await sdk6.getMemberEvents(mid6, { rewardSource: 'order' });
  assert(rewardSourceEvents.total >= 1, '按奖励来源=order筛选到>=1条');

  const combinedFilter = await sdk6.getMemberEvents(mid6, {
    types: ['earn_points'],
    source: 'order',
  });
  assert(combinedFilter.total >= 1, '按类型+来源组合筛选到>=1条');
  console.log();

  console.log('【7. 退款/取消/部分退款事件类型测试】');
  const sdk7 = createTestSDK();
  const mid7 = 'test_refund_events';
  await sdk7.register({ memberId: mid7, nickname: '退款流水', registerTime: Date.now() });
  await sdk7.placeOrder(mid7, 200, 'event_refund_001');
  await sdk7.refundOrder(mid7, 'event_refund_001', 200);

  const refundEvents = await sdk7.getMemberEvents(mid7, { types: ['refund_order'] });
  assert(refundEvents.total === 1, '退款事件1条');
  assert(refundEvents.list[0].type === 'refund_order', '类型为 refund_order');
  assert(refundEvents.list[0].pointsChange < 0, '积分变化为负');
  assert(refundEvents.list[0].growthChange < 0, '成长值变化为负');
  console.log();

  console.log('【8. 基础功能回归测试】');
  const sdk8 = createTestSDK();
  const mid8 = 'regression_v4';
  const acc = await sdk8.register({ memberId: mid8, nickname: '回归', registerTime: Date.now() });
  assert(acc.memberId === mid8, '注册正常');
  assert(acc.signInCycle === 1, 'signInCycle=1');
  assert(acc.makeupUsedCount === 0, 'makeupUsedCount=0');

  const earn = await sdk8.earnPoints(mid8, 100, 'reg');
  assert(earn.success === true, '积分累计正常');

  const spend = await sdk8.spendPoints(mid8, 30, 'reg');
  assert(spend.success === true && spend.remainingPoints === 70, '积分扣减正常');

  const taskDaily = await sdk8.completeTask(mid8, 't2');
  assert(taskDaily.success === true, '每日任务正常');

  const info = await sdk8.getMemberInfo(mid8);
  assert(info!.level === 1, '等级查询正常');

  const issuedCoupon = await sdk8.issueCoupon(mid8, 'ct_test');
  assert(issuedCoupon.success === true, '发券正常');
  assert(issuedCoupon.coupon.source === 'system', '券来源标记 system');
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
