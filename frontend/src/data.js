import { getGlobalCharPoolOrder, getGlobalWeaponPoolOrder } from './state.js';
import { SPARK_TIER1, SPARK_TIER2, PITY_BOOST_START } from './constants.js';

export function groupDataByPool(flatList) {
  const grouped = {};
  if (!flatList || flatList.length === 0) return grouped;
  flatList.forEach(item => {
    const pool = item.poolName || "UNKNOWN";
    if (!grouped[pool]) {
      grouped[pool] = [];
    }
    grouped[pool].push(item);
  });
  return grouped;
}

// 获取通用名称 (处理 CharName 和 WeaponName 的差异)
export function getItemName(item) {
  return item.charName || item.weaponName || "UNKNOWN";
}

// 计算卡池六星详细信息
export function calculateSixStarDetails(items, reverse = false, allItems) {
  // allItems 用于计算 pityCounter（跨池继承），items 决定显示哪些池子
  const pitySource = allItems || items;
  // 按时间排序（保证跨池保底计数正确），再按卡池分组
  const sorted = [...pitySource].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  const pools = {};
  const poolOrder = [];
  sorted.forEach(item => {
    const key = item.poolName;
    if (!pools[key]) {
      pools[key] = [];
      poolOrder.push(key);
    }
    pools[key].push(item);
  });

  // 需要显示 6★ 的池子集合
  const displayPools = new Set(items.map(i => i.poolName));

  // 按卡池分别统计
  // pityCounter：跨池累加（排除池冻结），用于继承水位角标
  // poolPity：当前池内计数，用于 pityText 显示
  const allDetails = [];
  let pityCounter = 0;
  for (const key of poolOrder) {
    const firstItem = pools[key][0];
    const isExcluded = EXCLUDED_FROM_PITY.includes(firstItem?.poolId);

    if (isExcluded) {
      // 排除池：冻结 pityCounter，用独立 poolPity 计数
      const saved = pityCounter;
      let poolPity = 0;
      pools[key].forEach(item => {
        if (item.rarity === 6 && displayPools.has(key)) {
          const detail = {
            name: getItemName(item),
            isNew: item.isNew,
            pityText: item.isFree ? "FREE" : ++poolPity
          };
          if (item.poolName) detail.poolName = item.poolName;
          allDetails.push(detail);
          if (!item.isFree) poolPity = 0;
        } else {
          if (!item.isFree) poolPity++;
        }
      });
      pityCounter = saved; // 恢复，排除池不影响继承链
    } else {
      // 非排除池：pityCounter 跨池累加，poolPity 当前池内计数
      const details = [];
      const inheritedPity = pityCounter;
      let poolPity = 0;
      let firstSixStar = true;
      pools[key].forEach(item => {
        if (item.rarity === 6) {
          if (displayPools.has(key)) {
            const detail = {
              name: getItemName(item),
              isNew: item.isNew,
              pityText: item.isFree ? "FREE" : ++poolPity
            };
            if (item.poolName) detail.poolName = item.poolName;
            if (!item.isFree && firstSixStar && inheritedPity > 0) {
              detail.inheritedPity = inheritedPity;
            }
            details.push(detail);
          } else {
            if (!item.isFree) poolPity++;
          }
          firstSixStar = false;
          if (!item.isFree) { pityCounter = 0; poolPity = 0; }
        } else {
          if (!item.isFree) { pityCounter++; poolPity++; }
        }
      });
      if (reverse) details.reverse();
      allDetails.push(...details);
    }
  }
  return allDetails;
}

// 计算卡池大保底信息
export function calculateSparkInfo(reversed, targetUp) {
  let sparkCount = 0;
  let sparkConsumed = false;
  for (let item of reversed) {
    if (!item.isFree) sparkCount++;
    const name = getItemName(item);
    if (name === targetUp && !item.isFree && sparkCount <= SPARK_TIER1) {
      sparkConsumed = true;
    }
  }

  let targetLimit, rightCornerSub;
  if (sparkCount >= SPARK_TIER2) {
    targetLimit = SPARK_TIER2;
    rightCornerSub = "MAX SPARK REACHED";
  } else if (sparkCount > SPARK_TIER1) {
    targetLimit = SPARK_TIER2;
    rightCornerSub = `NEXT TARGET: ${SPARK_TIER2}`;
  } else {
    targetLimit = sparkConsumed ? SPARK_TIER2 : SPARK_TIER1;
    rightCornerSub = sparkConsumed ? `${SPARK_TIER1} CONSUMED -> TARGET ${SPARK_TIER2}` : "LIMITED SPARK COUNT";
  }

  return { sparkCount, targetLimit, rightCornerSub };
}

// 不参与跨池水位继承的特殊卡池
const EXCLUDED_FROM_PITY = ['standard', 'beginner'];

// 计算每个池子各自的水位（保底计数跨池继承，出 6★ 归零）
// 返回 { poolName: pity } 的对象，pity 为该池子结束时的累计水位
// 基础寻访和启程寻访不参与继承链，不出现在返回值中
export function calculatePerPoolPity(dataMap, poolOrder) {
  const perPoolPity = {};
  let pity = 0;

  // 按配置顺序逐池遍历
  const allPoolNames = [...poolOrder];
  for (const poolName in dataMap) {
    if (!allPoolNames.includes(poolName)) {
      allPoolNames.push(poolName);
    }
  }

  for (const poolName of allPoolNames) {
    if (!dataMap[poolName]) continue;
    // 跳过特殊卡池，不参与跨池水位继承
    if (EXCLUDED_FROM_PITY.includes(dataMap[poolName][0]?.poolId)) continue;
    // 池内按时间升序排序，同时间戳按 seqId 升序（保证十连批次内顺序正确）
    const items = [...dataMap[poolName]].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

    for (const item of items) {
      if (item.isFree) continue;
      pity++;
      if (item.rarity === 6) { pity = 0; }
    }
    perPoolPity[poolName] = pity;
  }

  return perPoolPity;
}

// 水位概率计算
export function calculatePityBoost(currentPity, poolId) {
  if (currentPity >= PITY_BOOST_START && !EXCLUDED_FROM_PITY.includes(poolId)) {
    const extraRate = (currentPity - (PITY_BOOST_START - 1)) * 5;
    const nextProb = Math.min(0.8 + extraRate, 100);
    return {
      pityColor: "#ff5722",
      pitySubText: `NEXT PROB: ${nextProb}%`
    };
  }
  return {
    pityColor: "var(--ef-yellow)",
    pitySubText: "SINCE LAST 6★"
  };
}

// 计算卡池当前相关信息
export function calculatePoolStats(items) {
  const total = items.length;
  const notFreeTotal = items.filter(item => !item.isFree).length;
  const sixStarCount = items.filter(i => i.rarity === 6).length;
  const fiveStarCount = items.filter(i => i.rarity === 5).length;
  const fourStarCount = items.filter(i => i.rarity === 4).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  return { total, notFreeTotal, sixStarCount, fiveStarCount, fourStarCount, rate };
}

// 合并所有卡池的数据并按卡池配置顺序排序
export function mergeAllPoolsData(dataMap, type = 'char') {
  const poolOrder = (type === 'weapon') ? getGlobalWeaponPoolOrder() : getGlobalCharPoolOrder();
  const merged = [];
  // 新池→旧池遍历（反转配置顺序），保持池内顺序不变
  for (let i = poolOrder.length - 1; i >= 0; i--) {
    if (dataMap[poolOrder[i]]) {
      merged.push(...dataMap[poolOrder[i]]);
    }
  }
  // 再把 dataMap 中有但 poolOrder 没有的池子加进去（保底）
  for (const poolName in dataMap) {
    if (!poolOrder.includes(poolName)) {
      merged.push(...dataMap[poolName]);
    }
  }
  return merged;
}

// 平均出货抽数（排除免费抽，保底跨池继承，出 6★ 归零，基础寻访/启程寻访排除）
export function calculateAvgPity(items) {
  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  let pity = 0;
  let sixCount = 0;
  const pityList = [];
  let lastPoolId = '';
  let savedPity = 0;
  for (const item of sorted) {
    if (item.isFree) continue;
    if (item.poolId !== lastPoolId) {
      const wasExcluded = EXCLUDED_FROM_PITY.includes(lastPoolId);
      const nowExcluded = EXCLUDED_FROM_PITY.includes(item.poolId);
      if (nowExcluded && !wasExcluded) {
        savedPity = pity;  // 进入排除池，保存
        pity = 0;
      } else if (!nowExcluded && wasExcluded) {
        pity = savedPity;  // 离开排除池，恢复
      }
      lastPoolId = item.poolId;
    }
    pity++;
    if (item.rarity === 6) {
      pityList.push(pity);
      pity = 0;
      sixCount++;
    }
  }
  // 最后未出6★的抽数不计入平均（没有出货就不计入平均水位）
  const avgPity = pityList.length > 0
    ? +(pityList.reduce((a, b) => a + b, 0) / pityList.length).toFixed(1)
    : 0;
  return { avgPity, sixStarCount: sixCount };
}

// 最长不出货记录（排除免费抽，保底跨池继承，基础寻访/启程寻访排除）
export function calculateMaxDrought(items) {
  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  let maxDrought = 0;
  let currentStreak = 0;
  let lastPoolId = '';
  let savedStreak = 0;
  for (const item of sorted) {
    if (item.isFree) continue;
    if (item.poolId !== lastPoolId) {
      const wasExcluded = EXCLUDED_FROM_PITY.includes(lastPoolId);
      const nowExcluded = EXCLUDED_FROM_PITY.includes(item.poolId);
      if (nowExcluded && !wasExcluded) {
        savedStreak = currentStreak;
        currentStreak = 0;
      } else if (!nowExcluded && wasExcluded) {
        currentStreak = savedStreak;
      }
      lastPoolId = item.poolId;
    }
    if (item.rarity === 6) {
      if (currentStreak > maxDrought) maxDrought = currentStreak;
      currentStreak = 0;
    } else {
      currentStreak++;
    }
  }
  return { maxDrought, currentDrought: currentStreak };
}

// 按月统计抽数和出货数（排除免费抽）
export function calculateMonthlyStats(items, poolConfig = {}) {
  const monthMap = new Map();
  for (const item of items) {
    if (item.isFree) continue;
    const date = new Date(Number(item.gachaTs));
    if (isNaN(date.getTime())) continue;
    const month = date.toISOString().slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { totalPulls: 0, sixStarCount: 0, upCount: 0, offCount: 0 });
    }
    const entry = monthMap.get(month);
    entry.totalPulls++;
    if (item.rarity === 6) {
      entry.sixStarCount++;
      const upName = poolConfig[item.poolName];
      if (upName && getItemName(item) === upName) {
        entry.upCount++;
      } else {
        entry.offCount++;
      }
    }
  }
  const result = [];
  for (const [month, data] of monthMap) {
    result.push({
      month,
      totalPulls: data.totalPulls,
      sixStarCount: data.sixStarCount,
      upCount: data.upCount,
      offCount: data.offCount,
      rate: data.sixStarCount > 0
        ? ((data.sixStarCount / data.totalPulls) * 100).toFixed(2) + '%'
        : '0.00%'
    });
  }
  // 按月份从旧到新排序
  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}

// 6★ 之间的抽数间隔分布（排除免费抽，保底跨池继承，基础寻访/启程寻访排除）
export function calculatePityDistribution(items, poolConfig = {}) {
  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 1-10, 11-20, ..., 71-80, 80+
  const upBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const offBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let streak = 0;
  let lastPoolId = '';
  let savedStreak = 0;
  for (const item of sorted) {
    if (item.isFree) continue;
    if (item.poolId !== lastPoolId) {
      const wasExcluded = EXCLUDED_FROM_PITY.includes(lastPoolId);
      const nowExcluded = EXCLUDED_FROM_PITY.includes(item.poolId);
      if (nowExcluded && !wasExcluded) {
        savedStreak = streak;
        streak = 0;
      } else if (!nowExcluded && wasExcluded) {
        streak = savedStreak;
      }
      lastPoolId = item.poolId;
    }
    streak++;
    if (item.rarity === 6) {
      const bucketIndex = Math.min(Math.floor((streak - 1) / 10), 8);
      buckets[bucketIndex]++;
      const upName = poolConfig[item.poolName];
      if (upName && getItemName(item) === upName) {
        upBuckets[bucketIndex]++;
      } else {
        offBuckets[bucketIndex]++;
      }
      streak = 0;
    }
  }
  return {
    labels: ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '80+'],
    counts: buckets,
    upCounts: upBuckets,
    offCounts: offBuckets
  };
}
