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
      {
        id: 'ct_test',
        name: '测试券10元',
        type: 'cash',
        value: 10,
        validDays: 30,
      },
      {
        id: 'ct_discount',
        name: '9折券',
        type: 'discount',
        value: 0.9,
        validDays: 15,
      },
    ],
    benefitPackages: [
      {
        id: 'bp_2',
        level: 2,
        name: '白银包',
        description: '',
        couponTemplates: ['ct_discount'],
        privileges: ['专属客服'],
      },
      {
        id: 'bp_3',
        level: 3,
        name: '黄金包',
        description: '',
        couponTemplates: ['ct_test', 'ct_discount'],
        privileges: ['专属客服', '免费包邮'],
      },
    ],
    signInConfig: {
      cycleDays: 3,
      rewards: [
        { day: 1, points: 10, growth: 2 },
        { day: 2, points: 15, growth: 3 },
        { day: 3, points: 20, growth: 5, couponTemplateId: 'ct_test' },
      ],
    },
    tasks: [
      {
        id: 't1',
        name: '测试一次性任务',
        description: '',
        type: 'once',
        points: 100,
      },
      {
        id: 't2',
        name: '测试每日任务',
        description: '',
        type: 'daily',
        points: 10,
      },
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
  console.log('========== SDK 增强功能测试套件 ==========\n');

  console.log('【1. 下单综合结算接口测试 (placeOrder)】');
  const sdk1 = createTestSDK();
  const mid1 = 'test_order_user';
  await sdk1.register({
    memberId: mid1,
    nickname: '下单测试',
    registerTime: Date.now(),
  });

  const orderResult = await sdk1.placeOrder(mid1, 500, 'order_test_001');
  assert(orderResult.success === true, 'placeOrder 调用成功');
  assert(orderResult.orderId === 'order_test_001', '订单ID正确');
  assert(orderResult.orderAmount === 500, '订单金额正确');
  assert(orderResult.pointsEarned === 1000, '积分计算正确 (500 * 2 = 1000)');
  assert(orderResult.pointsRate === 2, '积分倍率返回正确');
  assert(orderResult.growthEarned === 500, '成长值计算正确 (500 * 1 = 500)');
  assert(orderResult.growthRate === 1, '成长值倍率返回正确');
  assert(orderResult.totalPoints === 1000, '累计积分正确');
  assert(orderResult.totalGrowth === 500, '累计成长值正确');
  assert(orderResult.levelChanged === true, '触发等级变更');
  assert(orderResult.oldLevel === 1 && orderResult.newLevel === 3, 'Lv.1 升到 Lv.3');
  assert(orderResult.currentLevel === 3, '当前等级 Lv.3');
  assert(orderResult.currentLevelName === '黄金', '等级名称正确');
  assert(orderResult.levelUpRewards.length >= 2, '获得升级奖励券（白银+黄金）');
  assert(orderResult.benefits.length === 2, '返回2个权益包');
  assert(orderResult.privileges.includes('专属客服') && orderResult.privileges.includes('免费包邮'), '返回特权列表正确');
  assert(orderResult.memberInfo !== null, '返回完整 memberInfo');
  assert(orderResult.memberInfo!.points === 1000, 'memberInfo 积分同步正确');
  assert(orderResult.memberInfo!.level === 3, 'memberInfo 等级同步正确');
  console.log();

  console.log('【2. 签到增强功能测试】');
  const sdk2 = createTestSDK();
  const mid2 = 'test_signin_user';
  await sdk2.register({
    memberId: mid2,
    nickname: '签到测试',
    registerTime: Date.now(),
  });

  const s1 = await sdk2.signIn(mid2, { returnMemberInfo: true });
  assert(s1.success === true, '第1天签到成功');
  assert(s1.day === 1, '第1天');
  assert(s1.cycle === 1, '第1轮');
  assert(s1.points === 10, '第1天+10积分');
  assert(s1.growth === 2, '第1天+2成长值');
  assert(s1.isCycleComplete === false, '本轮未完成');
  assert(s1.memberInfo !== null, 'signIn 可返回 memberInfo');

  const statusBefore2 = await sdk2.getSignInStatus(mid2);
  assert(statusBefore2.todaySignedIn === true, 'getSignInStatus: 今日已签到');
  assert(statusBefore2.currentDay === 1, '当前第1天');
  assert(statusBefore2.currentCycle === 1, '当前第1轮');
  assert(statusBefore2.cycleProgress === '1/3', '进度 1/3');
  assert(statusBefore2.calendar.length === 3, '返回3天日历');

  const s2 = await sdk2.signIn(mid2);
  assert(s2.success === false, '重复签到失败');

  const s3 = await sdk2.makeupSignIn(mid2, new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  assert(s3.success === true, '补签昨天成功');
  assert(s3.isMakeup === true, '标记为补签');
  assert(s3.day === 2, '补签后推进到第2天');

  const makeupFuture = await sdk2.makeupSignIn(mid2, new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  assert(makeupFuture.success === false, '不能补签未来日期');

  const s4 = await sdk2.signIn(mid2);
  const realDay4 = s4.success ? s4.day : 0;

  await sdk2.makeupSignIn(mid2, new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10));
  await sdk2.makeupSignIn(mid2, new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10));
  await sdk2.makeupSignIn(mid2, new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10));

  const statusAfter = await sdk2.getSignInStatus(mid2);
  assert(statusAfter.currentCycle >= 2 || statusAfter.continuousSignInDays >= 3, '经过多轮签到/补签，连续天数推进 >=3 或进入第2轮');
  console.log();

  console.log('【3. 优惠券体系增强测试】');
  const sdk3 = createTestSDK();
  const mid3 = 'test_coupon_user';
  await sdk3.register({
    memberId: mid3,
    nickname: '券测试',
    registerTime: Date.now(),
  });

  const issue1 = await sdk3.issueCoupon(mid3, 'ct_test');
  const issue2 = await sdk3.issueCoupon(mid3, 'ct_discount');
  await sdk3.useCoupon(issue1.coupon.id, 'order_use_001');

  const listResult = await sdk3.getCouponList(mid3);
  assert(listResult.total === 2, '共2张券');
  assert(listResult.unusedCount === 1, '未使用1张');
  assert(listResult.usedCount === 1, '已使用1张');
  assert(listResult.expiredCount === 0, '已过期0张');
  assert(listResult.unused[0].isExpiring !== undefined, '每张券附带 isExpiring 标识');
  assert(typeof listResult.unused[0].daysLeft === 'number', '每张券附带 daysLeft 天数');
  assert(Array.isArray(listResult.expiring), '返回 expiring 到期提醒数组');

  const unusedList = await sdk3.getCoupons(mid3, 'unused');
  assert(unusedList.length === 1, '按状态查未使用券正确');

  const expiringList = await sdk3.getExpiringCoupons(mid3, 60);
  assert(expiringList.length >= 1, '即将到期查询返回正确');
  assert(expiringList[0].daysLeft !== undefined, '即将到期列表带剩余天数');
  console.log();

  console.log('【4. 会员事件流水查询测试】');
  const sdk4 = createTestSDK();
  const mid4 = 'test_event_user';
  await sdk4.register({
    memberId: mid4,
    nickname: '流水测试',
    registerTime: Date.now(),
  });
  await sdk4.earnPoints(mid4, 50, 'test_source');
  await sdk4.signIn(mid4);
  await sdk4.completeTask(mid4, 't1');
  await sdk4.placeOrder(mid4, 300, 'ev_order_001');
  await sdk4.issueCoupon(mid4, 'ct_test');

  const events = await sdk4.getMemberEvents(mid4);
  assert(events.total >= 5, '至少5条事件（注册+积分+签到+任务+下单+发券）');
  assert(events.list.length >= 5, 'list 数组长度正确');
  assert(events.page === 1, '默认分页第1页');
  assert(events.pageSize === 20, '默认每页20条');
  assert(events.hasMore === false, 'hasMore 正确');

  if (events.list.length > 0) {
    const first = events.list[0];
    assert(first.memberId === mid4, '事件归属正确');
    assert(first.title !== undefined, '事件有 title');
    assert(first.description !== undefined, '事件有 description');
    assert(typeof first.pointsChange === 'number', 'pointsChange 字段存在');
    assert(typeof first.growthChange === 'number', 'growthChange 字段存在');
    assert(first.createTimeFormatted !== undefined, '格式化时间存在');
    assert(first.createTime > 0, '原始时间戳存在');
  }

  const orderEvents = await sdk4.getMemberEvents(mid4, { types: ['place_order'] });
  assert(orderEvents.total === 1, '按类型过滤 place_order 正确');
  assert(orderEvents.list[0].type === 'place_order', '事件类型标识正确');

  const pageQuery = await sdk4.getMemberEvents(mid4, { page: 1, pageSize: 2 });
  assert(pageQuery.list.length === 2, '分页 pageSize=2 正确');
  assert(pageQuery.hasMore === true, '分页后 hasMore=true');
  console.log();

  console.log('【5. 原有基础功能回归测试】');
  const sdk5 = createTestSDK();
  const mid5 = 'regression_user';
  const acc = await sdk5.register({ memberId: mid5, nickname: '回归', registerTime: Date.now() });
  assert(acc.memberId === mid5, '注册正常');
  assert(acc.signInCycle === 1, '新账号 signInCycle 初始化为1');

  const earn = await sdk5.earnPoints(mid5, 100, 'reg');
  assert(earn.success === true, '积分累计正常');

  const spend = await sdk5.spendPoints(mid5, 30, 'reg');
  assert(spend.success === true && spend.remainingPoints === 70, '积分扣减正常');

  const addGrowth = await sdk5.addGrowth(mid5, 150, 'reg');
  assert(addGrowth.levelChanged && addGrowth.newLevel === 2, '等级变更正常');

  const taskDaily = await sdk5.completeTask(mid5, 't2');
  assert(taskDaily.success === true, '每日任务完成正常');

  const info = await sdk5.getMemberInfo(mid5);
  assert(info!.level === 2 && info!.benefits.length === 1, '权益查询正常');
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
