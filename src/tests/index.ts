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
  console.log('========== SDK v3 增强功能测试 ==========\n');

  console.log('【1. 签到日历记录 + 补签规则测试】');
  const sdk1 = createTestSDK();
  const mid1 = 'test_signin_v3';
  await sdk1.register({ memberId: mid1, nickname: '签到V3', registerTime: Date.now() });

  const s1 = await sdk1.signIn(mid1, { returnMemberInfo: true });
  assert(s1.success === true, '第1天签到成功');
  assert(s1.day === 1, '第1天');
  assert(s1.isMakeup === false, '非补签');
  assert(s1.memberInfo !== null, '返回 memberInfo');

  await sdk1.earnPoints(mid1, 200, 'test_fund', { remark: '测试补签资金' });

  const status1 = await sdk1.getSignInStatus(mid1);
  assert(status1.todaySignedIn === true, '今日已签到');
  assert(status1.currentDay === 1, '当前第1天');
  assert(status1.cycleProgress === '1/3', '进度 1/3');
  assert(status1.makeupUsedCount === 0, '补签次数 0');
  assert(status1.makeupMaxCount === 2, '补签上限 2');
  assert(status1.makeupRemaining === 2, '补签剩余 2');
  assert(status1.makeupCostPoints === 50, '补签成本 50 积分');
  assert(status1.makeupWindowDays === 7, '补签窗口 7 天');

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const makeup1 = await sdk1.makeupSignIn(mid1, yesterday);
  assert(makeup1.success === true, '补签昨天成功');
  assert(makeup1.isMakeup === true, '标记为补签');
  assert(makeup1.makeupCost === 50, '补签扣了50积分');
  assert(makeup1.makeupRemaining === 1, '补签剩余1次');

  const status2 = await sdk1.getSignInStatus(mid1);
  assert(status2.makeupUsedCount === 1, '已补签1次');
  assert(status2.makeupRemaining === 1, '补签剩余1次');

  const duplicateMakeup = await sdk1.makeupSignIn(mid1, yesterday);
  assert(duplicateMakeup.success === false, '重复补签同一天失败');

  const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
  const makeup2 = await sdk1.makeupSignIn(mid1, twoDaysAgo);
  assert(makeup2.success === true, '第二次补签成功');
  assert(makeup2.makeupRemaining === 0, '补签次数用完');

  const status3 = await sdk1.getSignInStatus(mid1);
  assert(status3.makeupRemaining === 0, '剩余0次');

  const threeDaysAgo = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10);
  const makeupExhausted = await sdk1.makeupSignIn(mid1, threeDaysAgo);
  assert(makeupExhausted.success === false, '补签次数用完后失败');

  const calItem = status3.calendar.find(c => c.date === yesterday);
  assert(calItem !== undefined, '日历中能找到昨天');
  assert(calItem!.signedIn === true, '昨天标记已签');
  assert(calItem!.type === 'makeup', '昨天是补签类型');
  console.log();

  console.log('【2. 退款反向结算测试】');
  const sdk2 = createTestSDK();
  const mid2 = 'test_refund';
  await sdk2.register({ memberId: mid2, nickname: '退款测试', registerTime: Date.now() });

  const order1 = await sdk2.placeOrder(mid2, 500, 'refund_order_001');
  assert(order1.success === true, '下单成功');
  assert(order1.pointsEarned === 1000, '获得1000积分');
  assert(order1.growthEarned === 500, '获得500成长值');
  assert(order1.levelChanged === true, '触发升级');
  assert(order1.newLevel === 3, '升到Lv.3');
  assert(order1.levelUpRewards.length >= 2, '获得升级奖励券');

  const refund1 = await sdk2.refundOrder(mid2, 'refund_order_001', 500);
  assert(refund1.success === true, '退款成功');
  assert(refund1.pointsDeducted === 1000, '扣除1000积分');
  assert(refund1.growthDeducted === 500, '扣除500成长值');
  assert(refund1.levelChanged === true, '等级变化');
  assert(refund1.oldLevel === 3, '从Lv.3降级');
  assert(refund1.currentLevel === 1, '降回Lv.1');
  assert(refund1.couponsRevokedCount >= 1, '回收升级券');
  assert(refund1.memberInfo !== null, '返回 memberInfo');
  assert(refund1.benefits.length === 0, 'Lv.1无权益');

  const couponList = await sdk2.getCouponList(mid2);
  assert(couponList.revokedCount >= 1, '优惠券列表有 revoked 状态');
  assert(couponList.revoked.length >= 1, 'revoked 数组有内容');
  console.log();

  console.log('【3. 流水反查（按订单号）测试】');
  const sdk3 = createTestSDK();
  const mid3 = 'test_event_bizid';
  await sdk3.register({ memberId: mid3, nickname: '反查测试', registerTime: Date.now() });
  await sdk3.placeOrder(mid3, 300, 'biz_query_order_001');
  await sdk3.earnPoints(mid3, 50, 'manual', { bizId: 'biz_query_order_001' });

  const eventsByOrder = await sdk3.getEventsByBizId('biz_query_order_001');
  assert(eventsByOrder.total >= 2, '按订单号反查到>=2条事件');
  assert(eventsByOrder.list.every(e => e.bizId === 'biz_query_order_001'), '所有事件 bizId 匹配');

  const memberEventsWithBizId = await sdk3.getMemberEvents(mid3, { bizId: 'biz_query_order_001' });
  assert(memberEventsWithBizId.total >= 2, '会员流水按 bizId 过滤到>=2条');
  console.log();

  console.log('【4. 流水新增 refund_order 事件类型测试】');
  const sdk4 = createTestSDK();
  const mid4 = 'test_refund_event';
  await sdk4.register({ memberId: mid4, nickname: '退款流水', registerTime: Date.now() });
  await sdk4.placeOrder(mid4, 200, 'event_refund_001');
  await sdk4.refundOrder(mid4, 'event_refund_001', 200);

  const refundEvents = await sdk4.getMemberEvents(mid4, { types: ['refund_order'] });
  assert(refundEvents.total === 1, '退款事件1条');
  assert(refundEvents.list[0].type === 'refund_order', '类型为 refund_order');
  assert(refundEvents.list[0].pointsChange < 0, '积分变化为负');
  assert(refundEvents.list[0].growthChange < 0, '成长值变化为负');
  console.log();

  console.log('【5. 基础功能回归测试】');
  const sdk5 = createTestSDK();
  const mid5 = 'regression_v3';
  const acc = await sdk5.register({ memberId: mid5, nickname: '回归', registerTime: Date.now() });
  assert(acc.memberId === mid5, '注册正常');
  assert(acc.signInCycle === 1, 'signInCycle=1');
  assert(acc.makeupUsedCount === 0, 'makeupUsedCount=0');

  const earn = await sdk5.earnPoints(mid5, 100, 'reg');
  assert(earn.success === true, '积分累计正常');

  const spend = await sdk5.spendPoints(mid5, 30, 'reg');
  assert(spend.success === true && spend.remainingPoints === 70, '积分扣减正常');

  const taskDaily = await sdk5.completeTask(mid5, 't2');
  assert(taskDaily.success === true, '每日任务正常');

  const info = await sdk5.getMemberInfo(mid5);
  assert(info!.level === 1, '等级查询正常');

  const issuedCoupon = await sdk5.issueCoupon(mid5, 'ct_test');
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
