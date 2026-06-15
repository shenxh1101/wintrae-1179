import { MemberGrowthSDK, SDKConfig, MemberProfile } from '../index';

function createTestSDK(): MemberGrowthSDK {
  const config: SDKConfig = {
    appId: 'test-app',
    levels: [
      { level: 1, name: '普通', minGrowth: 0 },
      { level: 2, name: '白银', minGrowth: 100 },
      { level: 3, name: '黄金', minGrowth: 500 },
    ],
    couponTemplates: [
      {
        id: 'ct_test',
        name: '测试券',
        type: 'cash',
        value: 10,
        validDays: 30,
      },
    ],
    benefitPackages: [
      {
        id: 'bp_2',
        level: 2,
        name: '白银包',
        description: '',
        couponTemplates: ['ct_test'],
        privileges: ['test'],
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
    orderGrowthRate: 0.5,
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
  console.log('========== SDK 测试套件 ==========\n');

  const sdk = createTestSDK();
  const memberId = 'test_user_001';

  console.log('【注册与会员信息测试】');
  const profile: MemberProfile = {
    memberId,
    nickname: '测试用户',
    birthday: '1990-06-15',
    registerTime: Date.now(),
  };
  const account = await sdk.register(profile);
  assert(account.memberId === memberId, '注册成功，返回正确的 memberId');
  assert(account.level === 1, '初始等级为 Lv.1');
  assert(account.points === 0, '初始积分为 0');
  assert(account.growth === 0, '初始成长值为 0');

  const info = await sdk.getMemberInfo(memberId);
  assert(info !== null, 'getMemberInfo 返回非空');
  assert(info!.levelName === '普通', '等级名称正确');
  assert(info!.benefits.length === 0, 'Lv.1 暂无权益包');
  console.log();

  console.log('【积分管理测试】');
  const earnResult = await sdk.earnPoints(memberId, 50, 'test', { remark: '测试积分' });
  assert(earnResult.success === true, 'earnPoints 成功');
  assert(earnResult.points === 50, 'earnPoints 数量正确');
  assert(earnResult.totalPoints === 50, 'earnPoints 累计正确');

  const spendResult = await sdk.spendPoints(memberId, 20, 'test_spend');
  assert(spendResult.success === true, 'spendPoints 成功');
  assert(spendResult.remainingPoints === 30, 'spendPoints 剩余正确');

  const overSpend = await sdk.spendPoints(memberId, 1000, 'test_over');
  assert(overSpend.success === false, '积分不足时 spendPoints 失败');
  assert(overSpend.remainingPoints === 30, '积分不足时不扣减');

  const orderResult = await sdk.earnFromOrder(memberId, 100, 'order_001');
  assert(orderResult.points === 200, '订单积分按 rate 计算 (100 * 2 = 200)');
  assert(orderResult.totalPoints === 230, '订单积分正确累加');
  console.log();

  console.log('【成长值与等级测试】');
  const growthResult = await sdk.addGrowth(memberId, 150, 'test_growth');
  assert(growthResult.success === true, 'addGrowth 成功');
  assert(growthResult.totalGrowth === 150, '成长值累计正确');
  assert(growthResult.levelChanged === true, '触发等级变更');
  assert(growthResult.newLevel === 2, '升级到 Lv.2 (100-500)');
  assert(growthResult.levelUpRewards !== undefined, '升级奖励返回');

  const info2 = await sdk.getMemberInfo(memberId);
  assert(info2!.level === 2, '会员等级已更新');
  assert(info2!.benefits.length >= 1, '升级后获得权益包');
  assert(info2!.nextLevelGrowth === 500, '下一等级所需成长值正确');

  const orderGrowth = await sdk.addGrowthFromOrder(memberId, 200, 'order_002');
  assert(orderGrowth.growth === 100, '订单成长值按 rate 计算 (200 * 0.5 = 100)');
  console.log();

  console.log('【签到奖励测试】');
  const sign1 = await sdk.signIn(memberId);
  assert(sign1.success === true, '首次签到成功');
  assert(sign1.day === 1, '签到第1天');
  assert(sign1.points === 10, '第1天签到获得10积分');
  assert(sign1.growth === 2, '第1天签到获得2成长值');

  const signDuplicate = await sdk.signIn(memberId);
  assert(signDuplicate.success === false, '同一天重复签到失败');
  console.log();

  console.log('【任务奖励测试】');
  const taskOnce = await sdk.completeTask(memberId, 't1');
  assert(taskOnce.success === true, '一次性任务完成成功');
  assert(taskOnce.points === 100, '获得任务积分');

  const taskOnceAgain = await sdk.completeTask(memberId, 't1');
  assert(taskOnceAgain.alreadyCompleted === true, '一次性任务不能重复完成');

  const taskDaily = await sdk.completeTask(memberId, 't2');
  assert(taskDaily.success === true, '每日任务完成成功');
  console.log();

  console.log('【优惠券测试】');
  const issueResult = await sdk.issueCoupon(memberId, 'ct_test');
  assert(issueResult.success === true, '发券成功');
  assert(issueResult.coupon.status === 'unused', '新券状态为 unused');

  const coupons = await sdk.getCoupons(memberId, 'unused');
  assert(coupons.length >= 1, '可查询到未使用优惠券');

  const expiring = await sdk.getExpiringCoupons(memberId, 60);
  assert(expiring.length >= 1, '可查询到即将到期优惠券');
  console.log();

  console.log('【积分记录查询测试】');
  const records = await sdk.getPointRecords(memberId, 5);
  assert(records.length > 0, '可查询到积分记录');
  assert(records[0].createTime > records[records.length - 1].createTime, '积分记录按时间倒序');
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
