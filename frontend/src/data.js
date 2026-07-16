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
