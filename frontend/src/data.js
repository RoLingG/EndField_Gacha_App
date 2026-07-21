import { getGlobalCharPoolOrder, getGlobalWeaponPoolOrder } from './state.js';
import { SPARK_TIER1, SPARK_TIER2, PITY_BOOST_START } from './constants.js';

export function groupDataByPool(flatList) {
  const grouped = {};
  if (!flatList || flatList.length === 0) return grouped;
  flatList.forEach(item => {
    const pool = item.poolName || "未知卡池";
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

export function calculateSixStarDetails(items, reverse = false) {
  const list = reverse ? items.slice().reverse() : items;

  // 按卡池分组，每个卡池独立计算保底
  const pools = {};
  const poolOrder = [];
  list.forEach(item => {
    const key = item.poolName;
    if (!pools[key]) {
      pools[key] = [];
      poolOrder.push(key);
    }
    pools[key].push(item);
  });

  // 按卡池分别统计
  const allDetails = [];
  for (const key of poolOrder) {
    const details = [];
    let pityCounter = 0;
    pools[key].forEach(item => {
      if (item.rarity === 6) {
        const detail = {
          name: getItemName(item),
          isNew: item.isNew,
          pityText: item.isFree ? "FREE" : ++pityCounter
        };
        if (item.poolName) detail.poolName = item.poolName;
        details.push(detail);
        if (!item.isFree) pityCounter = 0;
      } else {
        if (!item.isFree) pityCounter++;
      }
    });
    if (reverse) details.reverse();
    allDetails.push(...details);
  }
  return allDetails;
}

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

export function calculatePityBoost(currentPity, poolName) {
  if (currentPity >= PITY_BOOST_START && poolName !== "基础寻访") {
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

export function calculatePoolStats(items) {
  const total = items.length;
  const notFreeTotal = items.filter(item => !item.isFree).length;
  const sixStarCount = items.filter(i => i.rarity === 6).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  return { total, notFreeTotal, sixStarCount, rate };
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

// 平均出货抽数（排除免费抽，按池隔离计算再取平均）
export function calculateAvgPity(items) {
  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs));
  let currentPoolPulls = 0;
  let sixCount = 0;
  let lastPool = null;
  const poolAvgList = [];
  for (const item of sorted) {
    if (item.isFree) continue;
    if (lastPool !== null && item.poolName !== lastPool) {
      currentPoolPulls = 0;
    }
    lastPool = item.poolName;
    currentPoolPulls++;
    if (item.rarity === 6) {
      poolAvgList.push(currentPoolPulls);
      currentPoolPulls = 0;
      sixCount++;
    }
  }
  // 最后一个池未出6★的抽数不计入平均（没有出货就不计入平均水位）
  const avgPity = poolAvgList.length > 0
    ? +(poolAvgList.reduce((a, b) => a + b, 0) / poolAvgList.length).toFixed(1)
    : 0;
  return { avgPity, sixStarCount: sixCount };
}

// 最长不出货记录（排除免费抽，跨池重置保底计数）
export function calculateMaxDrought(items) {
  // 按时间升序排序，确保抽数计算顺序正确
  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs));
  let maxDrought = 0;
  let currentStreak = 0;
  let lastPool = null;
  for (const item of sorted) {
    if (item.isFree) continue;
    // 切换卡池时重置保底计数（保底不跨池继承）
    if (lastPool !== null && item.poolName !== lastPool) {
      if (currentStreak > maxDrought) maxDrought = currentStreak;
      currentStreak = 0;
    }
    lastPool = item.poolName;
    if (item.rarity === 6) {
      if (currentStreak > maxDrought) maxDrought = currentStreak+1;
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

// 6★ 之间的抽数间隔分布（排除免费抽，跨池重置保底计数）
export function calculatePityDistribution(items, poolConfig = {}) {
  // 按时间升序排序，确保抽数计算顺序正确
  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs));
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 1-10, 11-20, ..., 71-80, 80+
  const upBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const offBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let streak = 0;
  let lastPool = null;
  for (const item of sorted) {
    if (item.isFree) continue;
    // 切换卡池时重置保底计数（保底不跨池继承）
    if (lastPool !== null && item.poolName !== lastPool) {
      streak = 0;
    }
    lastPool = item.poolName;
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
