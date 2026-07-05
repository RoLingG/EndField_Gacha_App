import { calculatePoolStats, calculateSparkInfo, calculatePityBoost } from '../data.js';
import { getCurrentType, getLastDataType, getGlobalPoolConfig } from '../state.js';
import { updateCurrencyDisplay } from '../utils.js';

export function createSummaryStrip(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const poolUpCharConfig = getGlobalPoolConfig() || {};
  const reversed = items.slice().reverse();

  let currentPity = 0;
  for (let item of reversed) {
    if (item.rarity === 6 && !item.isFree) {
      currentPity = 0;
    } else if (!item.isFree) {
      currentPity++;
    }
  }

  const { total, notFreeTotal, sixStarCount, rate } = calculatePoolStats(items);
  const currentType = getCurrentType();

  let centerLabel = "POOL TOTAL // 总抽取数";
  let centerValueHtml = total;
  let rightCornerSub = (currentType === 'char') ? "6★ GUARANTEED AT 80" : "UP 6★ GUARANTEED AT 80";
  let pityCount = (currentType === 'char') ? 80 : 40;
  const targetUpChar = poolUpCharConfig[poolName] || null;
  if (currentType === 'char' && targetUpChar) {
    centerLabel = "POOL SPARK // 本池垫刀";
    const spark = calculateSparkInfo(reversed, targetUpChar);
    rightCornerSub = spark.rightCornerSub;
    centerValueHtml = `${spark.sparkCount} <span style="font-size:12px;color:#666">/ ${spark.targetLimit}</span>`;
  }

  const pityBoost = calculatePityBoost(currentPity, poolName);
  const typeLabel = (currentType === 'char') ? "CHARACTERS" : "WEAPONS";
  document.getElementById('summaryStrip').innerHTML = `
    <div class="info-card">
      <div class="info-label">CURRENT PITY // 当前水位</div>
      <div class="info-value" style="color:${pityBoost.pityColor}">
        ${currentPity} <span style="font-size:12px;color:#666">/ ${pityCount}</span>
      </div>
      <div class="info-sub">${pityBoost.pitySubText}</div>
    </div>

    <div class="info-card">
      <div class="info-label">${centerLabel}</div>
      <div class="info-value">
        ${centerValueHtml}
      </div>
      <div class="info-sub">${rightCornerSub}</div>
    </div>

    <div class="info-card">
      <div class="info-label">6★ RATIO // 出货率</div>
      <div class="info-value">${rate}%</div>
      <div class="info-sub">${sixStarCount} ${typeLabel}</div>
    </div>
  `;
  updateCurrencyDisplay(notFreeTotal, currentType);
}

export function createAllPoolsSummaryStrip(items) {
  const { total, notFreeTotal, sixStarCount, rate } = calculatePoolStats(items);
  const typeLabel = (getLastDataType() === 'char') ? "CHARACTERS" : "WEAPONS";

  document.getElementById('summaryStrip').innerHTML = `
    <div class="info-card">
      <div class="info-label">TOTAL DRAWS // 总抽取数</div>
      <div class="info-value">${total}</div>
      <div class="info-sub">ALL POOLS COMBINED</div>
    </div>

    <div class="info-card">
      <div class="info-label">6★ COUNT // 六星出货数</div>
      <div class="info-value">${sixStarCount}</div>
      <div class="info-sub">TOTAL 6★ OBTAINED</div>
    </div>

    <div class="info-card">
      <div class="info-label">6★ RATIO // 出货率</div>
      <div class="info-value">${rate}%</div>
      <div class="info-sub">${sixStarCount} ${typeLabel}</div>
    </div>
  `;
  updateCurrencyDisplay(notFreeTotal, getLastDataType());
}
