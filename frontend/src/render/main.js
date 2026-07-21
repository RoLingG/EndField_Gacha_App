import {
  getCurrentType, setCurrentType,
  getLastDataType, setLastDataType,
  getGlobalCharData, getGlobalWeaponData,
  getCurrentPool, setCurrentPool, setCurrentAllPoolsData,
  setIsAllPoolsMode, getIsAllPoolsMode, setCurrentHistoryPage,
  getGlobalPoolConfig,
} from '../state.js';
import { createPoolButtons } from '../pool.js';
import { mergeAllPoolsData, calculateAvgPity, calculateMaxDrought, calculateMonthlyStats, calculatePityDistribution } from '../data.js';
import { updateOrCreateChart, renderPityDistributionChart, renderMonthlyTrendChart, destroyStatsCharts } from './chart.js';
import { createSummaryStrip, createAllPoolsSummaryStrip } from './summary.js';
import { createRareRecordCard, createAllPoolsRareRecordsCard } from './rare.js';
import { setPoolSelectorVisibility, updateSummaryStripVisibility, clearDisplay } from '../utils.js';
import { createHistoryTable, createAllPoolsHistoryTable, renderEmptyHistoryTable, updateHistoryPaginationUI } from './history.js';

// 核心切换逻辑
export function switchType(type) {
  if (getCurrentType() === type) return;
  setCurrentType(type);
  setCurrentHistoryPage(1);
  if (type !== 'all' && type !== 'stats') {
    setLastDataType(type);
  }
  updateAllBtnText();

  document.getElementById('btnTypeChar').classList.toggle('active', type === 'char');
  document.getElementById('btnTypeWeapon').classList.toggle('active', type === 'weapon');
  document.getElementById('btnTypeAll').classList.toggle('active', type === 'all');
  document.getElementById('btnTypeStats').classList.toggle('active', type === 'stats');

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  const statsPanel = document.getElementById('statsPanel');
  const dashboardPanel = document.getElementById('dashboardPanel');
  const historySection = document.getElementById('historySection');

  if (type === 'stats') {
    // 进入统计 tab：隐藏 dashboard 和 history，statsPanel 由 renderStatsTab 控制
    if (dashboardPanel) dashboardPanel.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
  } else {
    // 离开统计 tab：隐藏 statsPanel，恢复 dashboard 和 history
    if (statsPanel) statsPanel.style.display = 'none';
    if (dashboardPanel) dashboardPanel.style.display = '';
    if (historySection) historySection.style.display = '';
  }

  if (type === 'all') {
    setIsAllPoolsMode(true);
    if (poolSelectorWrapper && poolSelectorWrapper.style.opacity !== '0')
      setPoolSelectorVisibility(poolSelectorWrapper, false);
  } else if (type === 'stats') {
    // stats 模式：不修改 isAllPoolsMode，池子选择器在 renderStatsTab 中控制
  } else {
    setIsAllPoolsMode(false);
    if (poolSelectorWrapper && poolSelectorWrapper.style.opacity === '0')
      setPoolSelectorVisibility(poolSelectorWrapper, true);
  }

  renderByType(type);
}

export function renderByType(type) {
  if (type === 'all') {
    const allPoolsNoDataConfig = {
      chartMessage: '// NO ALL-POOLS CHART DATA',
      detailTitle: '// NO SUMMARY DATA',
      detailDesc: '当前汇总模式下暂无可展示记录。<br>Please switch type or load another archive.',
      historyMessage: '// NO ALL-POOLS HISTORY',
      detailLabel: 'ALL POOLS ANALYSIS',
      historyColspan: 5,
      hidePoolSelector: true
    };
    const dataMap = (getLastDataType() === 'char') ? getGlobalCharData() : getGlobalWeaponData();
    if (!dataMap || Object.keys(dataMap).length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    const allPoolsData = mergeAllPoolsData(dataMap, getLastDataType());
    if (!allPoolsData || allPoolsData.length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    setCurrentAllPoolsData(allPoolsData);
    updateSummaryStripVisibility(true);
    displayAllPoolsSummary(allPoolsData);
    return;
  }

  // 统计分析 tab
  if (type === 'stats') {
    renderStatsTab();
    return;
  }

  const dataMap = (type === 'char') ? getGlobalCharData() : getGlobalWeaponData();
  if (!dataMap || Object.keys(dataMap).length === 0) {
    renderNoDataState();
    return;
  }

  updateSummaryStripVisibility(true);
  setCurrentPool(Object.keys(dataMap)[0]);
  createPoolButtons(dataMap, updateDisplay, type);
  updateDisplay(dataMap, getCurrentPool());

  const thEl = document.getElementById('thName');
  if (thEl) {
    thEl.textContent = (type === 'char') ? "CHARACTER" : "WEAPON";
  }
}

// 统一渲染无数据主界面
export function renderNoDataState({
  poolMessage = '// NO DATA RECORDS FOUND',
  chartMessage = '// NO CHART DATA',
  detailTitle = '// NO DETAIL DATA',
  detailDesc = '当前所选类型暂无可展示记录。<br>Please switch pool/type or load another archive.',
  historyMessage = '// NO HISTORY RECORDS',
  detailLabel = 'TARGET POOL UNAVAILABLE',
  historyColspan = 5,
  hidePoolSelector = false
} = {}) {
  clearDisplay();
  setCurrentPool(null);
  setCurrentAllPoolsData(null);

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (poolSelectorWrapper) {
    const isHidden = poolSelectorWrapper.style.opacity === '0';
    if (isHidden !== hidePoolSelector) {
      setPoolSelectorVisibility(poolSelectorWrapper, !hidePoolSelector);
    }
    if (!hidePoolSelector) {
      poolSelectorWrapper.innerHTML = `
        <div style="color:#666; padding:10px; font-weight: bold; font-size: 18px;">
          ${poolMessage}
        </div>
      `;
    }
  }

  updateSummaryStripVisibility(false);

  const chartContainer = document.getElementById('chartContainer');
  const rareCharsContainer = document.getElementById('rareCharsContainer');
  if (chartContainer) {
    chartContainer.querySelectorAll("canvas, .chart-no-data").forEach(el => el.remove());
    const noData = document.createElement("div");
    noData.className = "chart-no-data";
    noData.style.cssText = "display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#666; font-size:20px; font-weight:bold;";
    noData.textContent = chartMessage;
    chartContainer.appendChild(noData);
  }
  if (rareCharsContainer) {
    rareCharsContainer.innerHTML = `
      <div style="padding:40px 32px; color:#666;">
        <div style="font-size:12px; letter-spacing:2px; margin-bottom:16px;">${detailLabel}</div>
        <div style="font-size:28px; font-weight:bold; margin-bottom:16px;">${detailTitle}</div>
        <div style="font-size:14px; line-height:1.8;">
          ${detailDesc}
        </div>
      </div>
    `;
  }
  renderEmptyHistoryTable(historyMessage, historyColspan);
  updateHistoryPaginationUI(0, 0);
}

export function updateDisplay(dataMap, poolName) {
  if (!poolName || !dataMap || !dataMap[poolName]) return;
  updateOrCreateChart(dataMap[poolName]);
  createRareRecordCard(dataMap, poolName);
  createSummaryStrip(dataMap, poolName);
  createHistoryTable(dataMap, poolName);
}

// 汇总模式的主显示函数
export function displayAllPoolsSummary(allItems) {
  updateOrCreateChart(allItems);
  createAllPoolsRareRecordsCard(allItems);
  createAllPoolsSummaryStrip(allItems);
  createAllPoolsHistoryTable(allItems);
}

// 更新汇总/统计卡池标签
export function updateAllBtnText() {
  const hint = (getLastDataType() === 'char') ? "CHAR" : "WEAPON";
  const allBtn = document.getElementById('btnTypeAll');
  if (allBtn) allBtn.textContent = `[ ALL / 汇总分析 (${hint}) ]`;
  const statsHint = getIsAllPoolsMode() ? "ALL" : hint;
  const statsBtn = document.getElementById('btnTypeStats');
  if (statsBtn) statsBtn.textContent = `[ STATS / 统计分析 (${statsHint}) ]`;
}

// 统计分析 tab 入口
function renderStatsTab() {
  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel) statsPanel.style.display = '';

  updateSummaryStripVisibility(false);

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  const isAllPools = getIsAllPoolsMode();

  if (isAllPools) {
    // 汇总模式：隐藏池子选择器（保留内容，切回时 scrollHeight 才准确）
    if (poolSelectorWrapper && poolSelectorWrapper.style.opacity !== '0') {
      setPoolSelectorVisibility(poolSelectorWrapper, false);
    }

    const dataMap = (getLastDataType() === 'char') ? getGlobalCharData() : getGlobalWeaponData();
    if (!dataMap || Object.keys(dataMap).length === 0) {
      renderStatsContent(null, true);
      return;
    }
    const allPoolsData = mergeAllPoolsData(dataMap, getLastDataType());
    renderStatsContent(allPoolsData, true);
    return;
  }

  // 单池模式：确保池子选择器完全可见，再创建按钮
  if (poolSelectorWrapper) {
    poolSelectorWrapper.style.transition = 'none';
    poolSelectorWrapper.style.height = '';
    poolSelectorWrapper.style.opacity = '1';
    poolSelectorWrapper.style.marginBottom = '20px';
    poolSelectorWrapper.style.overflow = '';
  }

  const type = getLastDataType() || 'char';
  const dataMap = (type === 'char') ? getGlobalCharData() : getGlobalWeaponData();
  if (!dataMap || Object.keys(dataMap).length === 0) {
    renderStatsContent(null, false);
    return;
  }

  const poolNames = Object.keys(dataMap);
  const defaultPool = poolNames[0];
  renderStatsContent(dataMap[defaultPool], false);

  // 复用主池子选择器，绑定统计回调
  createPoolButtons(dataMap, (dm, poolName) => {
    renderStatsContent(dm[poolName], false);
  }, type);
}

// 渲染统计内容
function renderStatsContent(items, isAllPools) {
  const statsCardsRow = document.getElementById('statsCardsRow');
  const pityDistContainer = document.getElementById('pityDistChartContainer');
  const monthlyContainer = document.getElementById('monthlyChartContainer');
  const pityDistBody = document.getElementById('pityDistChartBody');
  const monthlyBody = document.getElementById('monthlyChartBody');

  if (!items || items.length === 0) {
    if (statsCardsRow) statsCardsRow.innerHTML = '';
    if (pityDistBody) pityDistBody.innerHTML = '<div style="color:#666;padding:40px;text-align:center;font-weight:bold;">// NO STATS DATA</div>';
    if (monthlyBody) monthlyBody.innerHTML = '';
    if (monthlyContainer) monthlyContainer.style.display = 'none';
    destroyStatsCharts();
    return;
  }

  // 统计卡片
  const avg = calculateAvgPity(items);
  const drought = calculateMaxDrought(items);
  if (statsCardsRow) {
    statsCardsRow.innerHTML =
      createStatCard('AVG PITY // 平均水位', avg.avgPity, `共 ${avg.sixStarCount} 个 6★`) +
      createStatCard('MAX DROUGHT // 最大未抽出间隔', drought.maxDrought, `当前连续 ${drought.currentDrought} 抽未出 6★`);
  }

  // 抽数分布图（始终显示）
  const poolConfig = getGlobalPoolConfig() || {};
  const distribution = calculatePityDistribution(items, poolConfig);
  if (pityDistContainer) pityDistContainer.style.display = '';
  renderPityDistributionChart(distribution);

  // 月度趋势图（汇总模式才显示）
  if (isAllPools) {
    const monthlyData = calculateMonthlyStats(items, poolConfig);
    if (monthlyContainer) monthlyContainer.style.display = '';
    renderMonthlyTrendChart(monthlyData);
  } else {
    if (monthlyContainer) monthlyContainer.style.display = 'none';
  }
}

function createStatCard(label, value, sub) {
  return `<div class="stats-card">
    <div class="stats-card-label">${label}</div>
    <div class="stats-card-value">${value}</div>
    <div class="stats-card-sub">${sub}</div>
  </div>`;
}

// 主题切换时重建 stats 图表（仅在 stats 标签页生效）
export function rerenderStatsCharts() {
  if (getCurrentType() !== 'stats') return;
  destroyStatsCharts();
  renderStatsTab();
}
