import { MemberGrowthSDK, SDKConfig, MemberProfile } from '../index';

const config: SDKConfig = {
  appId: 'demo-app-001',
  levels: [
    { level: 1, name: '普通会员', minGrowth: 0 },
    { level: 2, name: '白银会员', minGrowth: 100 },
    { level: 3, name: '黄金会员', minGrowth: 500 },
    { level: 4, name: '铂金会员', minGrowth: 2000 },
    { level: 5, name: '钻石会员', minGrowth: 10000 },
  ],
  couponTemplates: [
    {
      id: 'ct_10off',
      name: '9折优惠券',
      type: 'discount',
      value: 0.9,
      validDays: 30,
    },
    {
      id: 'ct_50cash',
      name: '50元现金券',
      type: 'cash',
      value: 50,
      threshold: 200,
      validDays: 15,
    },
  ],
  benefitPackages: [
    {
      id: 'bp_1',
      level: 2,
      name: '白银权益包',
      description: '白银会员专享权益',
      pointMultiplier: 1.2,
      couponTemplates: ['ct_10off'],
      privileges: ['专属客服', '优先发货'],
    },
    {
      id: 'bp_2',
      level: 3,
      name: '黄金权益包',
      description: '黄金会员专享权益',
      pointMultiplier: 1.5,
      couponTemplates: ['ct_10off', 'ct_50cash'],
      privileges: ['专属客服', '优先发货', '免费包邮', '生日礼品'],
    },
    {
      id: 'bp_3',
      level: 4,
      name: '铂金权益包',
      description: '铂金会员专享权益',
      pointMultiplier: 2,
      couponTemplates: ['ct_10off', 'ct_50cash'],
      privileges: ['专属客服', '优先发货', '免费包邮', '生日礼品', 'VIP活动'],
    },
    {
      id: 'bp_4',
      level: 5,
      name: '钻石权益包',
      description: '钻石会员专享权益',
      pointMultiplier: 3,
      couponTemplates: ['ct_10off', 'ct_50cash'],
      privileges: ['1对1客服', '极速发货', '全场包邮', '生日豪礼', 'VIP专属活动', '新品优先体验'],
    },
  ],
  signInConfig: {
    cycleDays: 7,
    rewards: [
      { day: 1, points: 10 },
      { day: 2, points: 15 },
      { day: 3, points: 20 },
      { day: 4, points: 25 },
      { day: 5, points: 30 },
      { day: 6, points: 40 },
      { day: 7, points: 100, couponTemplateId: 'ct_50cash' },
    ],
  },
  tasks: [
    {
      id: 'task_first_order',
      name: '完成首单',
      description: '完成您的第一笔订单',
      type: 'once',
      points: 200,
      growth: 50,
    },
    {
      id: 'task_daily_share',
      name: '每日分享',
      description: '每天分享商品到社交平台',
      type: 'daily',
      points: 20,
      growth: 5,
    },
    {
      id: 'task_weekly_review',
      name: '每周评价',
      description: '每周对已购商品进行评价',
      type: 'weekly',
      points: 50,
      growth: 20,
      couponTemplateId: 'ct_10off',
    },
  ],
  birthdayRewardPoints: 500,
  birthdayRewardGrowth: 100,
  birthdayRewardCouponTemplateId: 'ct_50cash',
  orderPointRate: 1,
  orderGrowthRate: 1,
  logCallback: (log) => {
    console.log(`[LOG] ${log.module} - ${log.action}`, JSON.stringify(log.detail));
  },
};

async function runDemo() {
  console.log('========== 会员成长体系 SDK 演示 ==========\n');

  const sdk = new MemberGrowthSDK(config);

  const member: MemberProfile = {
    memberId: 'user_1001',
    nickname: '小明',
    avatar: 'https://example.com/avatar.jpg',
    birthday: '1990-06-15',
    registerTime: Date.now(),
    phone: '13800138000',
  };

  console.log('1. 注册会员...');
  const account = await sdk.register(member);
  console.log(`   注册成功: ${account.profile.nickname} (${account.memberId})`);
  console.log(`   当前等级: Lv.${account.level}\n`);

  console.log('2. 查询会员信息...');
  const info = await sdk.getMemberInfo('user_1001');
  if (info) {
    console.log(`   会员: ${info.profile.nickname}`);
    console.log(`   等级: ${info.levelName} (Lv.${info.level})`);
    console.log(`   积分: ${info.points}`);
    console.log(`   成长值: ${info.growth}`);
    if (info.nextLevelGrowth) {
      console.log(`   距下一等级还需: ${info.nextLevelGrowth - info.growth} 成长值\n`);
    }
  }

  console.log('3. 订单消费积分 + 成长值 (299元订单)...');
  const orderResult = await sdk.earnFromOrder('user_1001', 299, 'order_20260615001', { alsoGrowth: true });
  console.log(`   获得积分: +${orderResult.points}`);
  console.log(`   当前总积分: ${orderResult.totalPoints}`);
  if (orderResult.levelChanged) {
    console.log(`   等级变更: Lv.${orderResult.newLevel}`);
  }
  console.log();

  console.log('4. 每日签到...');
  const signInResult = await sdk.signIn('user_1001');
  console.log(`   签到成功: 第${signInResult.day}天`);
  console.log(`   连续签到: ${signInResult.isContinuous ? '是' : '否'}`);
  if (signInResult.points) console.log(`   获得积分: +${signInResult.points}`);
  if (signInResult.growth) console.log(`   获得成长值: +${signInResult.growth}`);
  if (signInResult.coupon) console.log(`   获得优惠券: ${signInResult.coupon.name}\n`);

  console.log('5. 完成任务 - 每日分享...');
  const taskResult = await sdk.completeTask('user_1001', 'task_daily_share');
  if (taskResult.success) {
    console.log(`   任务完成!`);
    if (taskResult.points) console.log(`   获得积分: +${taskResult.points}`);
    if (taskResult.growth) console.log(`   获得成长值: +${taskResult.growth}`);
    if (taskResult.coupon) console.log(`   获得优惠券: ${taskResult.coupon.name}`);
  } else if (taskResult.alreadyCompleted) {
    console.log('   今日已完成该任务\n');
  }
  console.log();

  console.log('6. 手动发放积分 + 成长值 (升级演示)...');
  const growthResult = await sdk.addGrowth('user_1001', 600, 'bonus', { remark: '活动奖励' });
  console.log(`   获得成长值: +${growthResult.growth}`);
  console.log(`   总成长值: ${growthResult.totalGrowth}`);
  console.log(`   当前等级: Lv.${growthResult.currentLevel}`);
  if (growthResult.levelChanged) {
    console.log(`   等级变更: Lv.${growthResult.oldLevel} -> Lv.${growthResult.newLevel}`);
    if (growthResult.levelUpRewards) {
      console.log(`   升级奖励优惠券: ${growthResult.levelUpRewards.map(c => c.name).join(', ')}`);
    }
  }
  console.log();

  console.log('7. 查询会员权益...');
  const updatedInfo = await sdk.getMemberInfo('user_1001');
  if (updatedInfo) {
    console.log(`   当前等级: ${updatedInfo.levelName}`);
    console.log(`   可用权益包: ${updatedInfo.benefits.map(b => b.name).join(', ')}`);
    console.log(`   特权列表: ${updatedInfo.benefits.flatMap(b => b.privileges).filter((v, i, a) => a.indexOf(v) === i).join('、')}\n`);
  }

  console.log('8. 查询优惠券列表...');
  const coupons = await sdk.getCoupons('user_1001');
  console.log(`   共有 ${coupons.length} 张优惠券:`);
  coupons.forEach(c => {
    const expireDate = new Date(c.expireTime).toLocaleDateString();
    console.log(`     - [${c.status}] ${c.name} (有效期至 ${expireDate})`);
  });
  console.log();

  console.log('9. 积分扣减 (使用100积分抵扣)...');
  const spendResult = await sdk.spendPoints('user_1001', 100, 'deduct', {
    bizId: 'order_20260615002',
    remark: '积分抵扣订单',
  });
  if (spendResult.success) {
    console.log(`   扣减成功: -${spendResult.points}`);
    console.log(`   剩余积分: ${spendResult.remainingPoints}\n`);
  }

  console.log('10. 发放生日奖励...');
  const birthdayResult = await sdk.triggerBirthdayReward('user_1001');
  if (birthdayResult.success) {
    console.log(`   生日奖励已发放!`);
    if (birthdayResult.points) console.log(`   获得积分: +${birthdayResult.points}`);
    if (birthdayResult.growth) console.log(`   获得成长值: +${birthdayResult.growth}`);
    if (birthdayResult.coupon) console.log(`   获得优惠券: ${birthdayResult.coupon.name}`);
  } else if (birthdayResult.alreadyRewarded) {
    console.log('   今年已领取过生日奖励');
  } else {
    console.log('   今天不是生日，无法领取');
  }
  console.log();

  console.log('11. 最终会员状态...');
  const finalInfo = await sdk.getMemberInfo('user_1001');
  if (finalInfo) {
    console.log(`   等级: ${finalInfo.levelName} (Lv.${finalInfo.level})`);
    console.log(`   积分: ${finalInfo.points} (累计获得 ${finalInfo.totalPointsEarned})`);
    console.log(`   成长值: ${finalInfo.growth} (累计 ${finalInfo.totalGrowth})`);
    console.log(`   连续签到: ${finalInfo.continuousSignInDays} 天`);
    console.log(`   累计签到: ${finalInfo.totalSignInDays} 天`);
  }

  console.log('\n========== 演示结束 ==========');
}

runDemo().catch(console.error);
