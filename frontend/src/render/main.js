import {
  getCurrentType, setCurrentType,
  getLastDataType, setLastDataType,
  getGlobalCharData, getGlobalWeaponData,
  getCurrentPool, setCurrentPool, setCurrentAllPoolsData,
  setIsAllPoolsMode, setCurrentHistoryPage,
} from '../state.js';
import { createPoolButtons } from '../pool.js';
import { mergeAllPoolsData } from '../data.js';
import { updateOrCreateChart } from './chart.js';
import { createSummaryStrip, createAllPoolsSummaryStrip } from './summary.js';
import { createRareRecordCard, createAllPoolsRareRecordsCard } from './rare.js';
import { setPoolSelectorVisibility, updateSummaryStripVisibility, clearDisplay } from '../utils.js';
import { createHistoryTable, createAllPoolsHistoryTable, renderEmptyHistoryTable, updateHistoryPaginationUI } from './history.js';

// 核心切换逻辑
export function switchType(type) {
  if (getCurrentType() === type) return;
  setCurrentType(type);
  setCurrentHistoryPage(1);
  if (type !== 'all') {
    setLastDataType(type);
  }
  updateAllBtnText();

  document.getElementById('btnTypeChar').classList.toggle('active', type === 'char');
  document.getElementById('btnTypeWeapon').classList.toggle('active', type === 'weapon');
  document.getElementById('btnTypeAll').classList.toggle('active', type === 'all');

  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (type === 'all') {
    setIsAllPoolsMode(true);
    if (poolSelectorWrapper) setPoolSelectorVisibility(poolSelectorWrapper, false);
  } else {
    setIsAllPoolsMode(false);
    if (poolSelectorWrapper) setPoolSelectorVisibility(poolSelectorWrapper, true);
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
    const allPoolsData = mergeAllPoolsData(dataMap);
    if (!allPoolsData || allPoolsData.length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    setCurrentAllPoolsData(allPoolsData);
    updateSummaryStripVisibility(true);
    displayAllPoolsSummary(allPoolsData);
    return;
  }

  const dataMap = (type === 'char') ? getGlobalCharData() : getGlobalWeaponData();
  if (!dataMap || Object.keys(dataMap).length === 0) {
    renderNoDataState();
    return;
  }

  updateSummaryStripVisibility(true);
  setCurrentPool(Object.keys(dataMap)[0]);
  createPoolButtons(dataMap, updateDisplay);
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
    setPoolSelectorVisibility(poolSelectorWrapper, !hidePoolSelector);
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
    chartContainer.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#666; font-size:20px; font-weight:bold;">
        ${chartMessage}
      </div>
    `;
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

// 更新汇总卡池标签
export function updateAllBtnText() {
  const btn = document.getElementById('btnTypeAll');
  if (!btn) return;
  const hint = (getLastDataType() === 'char') ? "CHAR" : "WEAPON";
  btn.textContent = `[ ALL POOLS / 汇总分析 (${hint}) ]`;
}
