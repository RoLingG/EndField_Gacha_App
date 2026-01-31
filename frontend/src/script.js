// script.js
import {
  LoadGachaTokens,
  CheckLocalFiles,
  GetCharacterData,
  GetWeaponData,
  ReloadFrontend,
  WindowClose,
  WindowMinSize,
  WindowToggleMaxSize,
  OpenDataFolder,
  LoadLocalGachaHistory,
} from "../wailsjs/go/main/App";

// chart.js全局配置
Chart.defaults.color = '#ffffff';
Chart.defaults.borderColor = '#333333';
Chart.defaults.font.family = "'Consolas', 'Monaco', monospace";

// 默认是在线模式
window.isOfflineSelection = false;

// 窗口顶部栏双按钮逻辑处理
window.handleOpenFolder = async () => await OpenDataFolder();
window.handleReload = async () => await ReloadFrontend();

const maxBtn = document.getElementById("maxBtn");
if(maxBtn){
  maxBtn.onclick = async () => {
    const isMax = await WindowToggleMaxSize();
    maxBtn.textContent = isMax ? "❐" : "□";
  };
}
document.getElementById("minBtn").onclick = () => WindowMinSize();
document.getElementById("closeBtn").onclick = () => WindowClose();

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const container = document.getElementById('analyzeContainer');
    if (container) container.classList.add('show');
  }, 100);
});

// 全局数据存储
let globalCharData = null;
let globalWeaponData = null;
let currentType = 'char'; // 'char' | 'weapon'
let currentPool = null;
let gachaChartInstance = null; // 图表实例复用

function groupDataByPool(flatList) {
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

function showLoadingState(mainText, subText) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = "flex";
  loadingOverlay.style.opacity = "1";
  loadingOverlay.style.transform = "translateY(0)";
  document.querySelector('.loading-text').textContent = mainText;
  document.querySelector('.loading-subtext').textContent = subText;
  const analyzeContainer = document.getElementById("analyzeContainer");
  analyzeContainer.style.opacity = "0";
  setTimeout(() => analyzeContainer.style.display = "none", 500);
}

// 双服选择逻辑处理
window.onSelectServer = async function(serverName) {
  // 启动全屏 Loading
  const actionText = window.isOfflineSelection ? "LOADING ARCHIVE" : "TARGET LOCKED";
  showLoadingState(actionText, `ACCESSING ${serverName.toUpperCase()} DATABASE...`);
  try {
    // 根据标志位决定调用哪个模式
    if (window.isOfflineSelection) {
      // 离线模式: true
      await initApp(true, serverName);
    } else {
      // 在线模式: false
      await initApp(false, serverName);
    }
  } catch (err) {
    console.error(err);
    resetToAnalyze();
    document.getElementById("analyzeError").textContent = "INIT ERROR: " + err;
  } finally {
    // 重置标志位
    window.isOfflineSelection = false;
  }
}

// 在线分析逻辑处理
window.analyze = async function () {
  const btn = document.getElementById("analyzeBtn");
  const originalText = btn.textContent;

  btn.textContent = "CHECKING SIGNALS...";
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";

  try {
    const tokens = await LoadGachaTokens();
    console.log("Tokens Found:", tokens);
    const hasOfficial = tokens.Official && tokens.Official.length > 0;
    const hasBilibili = tokens.Bilibili && tokens.Bilibili.length > 0;

    if (!hasOfficial && !hasBilibili) {
      throw "NO TOKEN DETECTED // 未找到抽卡记录链接";
    }

    // === 双服逻辑 ===
    if (hasOfficial && hasBilibili) {
      // 此时界面还完全显示着，只需要切换内部的按钮区域
      document.getElementById("defaultBtnGroup").style.display = "none";
      document.getElementById("serverSelectArea").style.display = "block";

      // 恢复按钮状态，以便下次取消回来时正常
      btn.textContent = originalText;
      btn.disabled = false;
      return; // 停在这里等待用户点击选择
    }

    // === 单服逻辑 ===
    let targetServer = "official";
    if (hasBilibili) targetServer = "bilibili";

    // 恢复按钮
    btn.textContent = originalText;
    btn.disabled = false;

    // 启动全屏动画
    showLoadingState("SYSTEM SYNCHRONIZING...", `TARGET CONFIRMED: ${targetServer.toUpperCase()}`);
    await initApp(false, targetServer);

  } catch (err) {
    console.error(err);
    // 出错恢复按钮
    btn.textContent = originalText;
    btn.disabled = false;
    document.getElementById("analyzeError").textContent = "ERR: " + err;
  }
}


// 离线分析文件
window.loadLocal = async function () {
  const btn = document.getElementById("localBtn");
  const originalText = btn.textContent;
  btn.textContent = "SCANNING FILES...";
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";
  try {
    // 检查本地有哪些文件
    const status = await CheckLocalFiles();
    console.log("Local Files:", status);
    const hasOfficial = status.hasOfficial;
    const hasBilibili = status.hasBilibili;
    if (!hasOfficial && !hasBilibili) {
      throw "NO LOCAL ARCHIVES FOUND // 未找到本地历史记录";
    }
    // 如果两个都有，显示选择界面 (复用 analyze 的逻辑)
    if (hasOfficial && hasBilibili) {
      // 切换 DOM 显示 B 服/官服按钮
      document.getElementById("defaultBtnGroup").style.display = "none";
      document.getElementById("serverSelectArea").style.display = "block";

      // 标记当前模式为 "offline"
      window.isOfflineSelection = true;
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }
    // 只有一个，直接加载
    let targetServer = "official";
    if (hasBilibili) targetServer = "bilibili";
    btn.textContent = originalText;
    btn.disabled = false;
    showLoadingState("LOADING LOCAL ARCHIVES...", `TARGET: ${targetServer.toUpperCase()}`);
    await initApp(true, targetServer);
  } catch (err) {
    console.error(err);
    btn.textContent = originalText;
    btn.disabled = false;
    document.getElementById("analyzeError").textContent = "ERR: " + err;
  }
}

async function initApp(isOfflineMode, serverName = "official") {
  const loadingText = document.querySelector('.loading-text');
  let charDataGrouped, weaponDataGrouped;
  if (isOfflineMode) {
    // 离线模式
    loadingText.textContent = 'READING LOCAL FILES...';
    const dataStruct = await LoadLocalGachaHistory(serverName);
    charDataGrouped = JSON.parse(dataStruct.char || "{}");
    weaponDataGrouped = JSON.parse(dataStruct.weapon || "{}");
  } else {
    // 在线模式
    loadingText.textContent = 'FETCHING DATA ...';
    const charList = await GetCharacterData(serverName);
    charDataGrouped = groupDataByPool(charList);
    let weaponList = [];
    try {
      weaponList = await GetWeaponData(serverName);
    } catch (e) {
      console.warn("Weapon data fetch failed:", e);
    }
    weaponDataGrouped = groupDataByPool(weaponList);
  }
  globalCharData = charDataGrouped;
  globalWeaponData = weaponDataGrouped;
  loadingText.textContent = 'DATA STREAM RECEIVED';
  // 初始化显示 (默认显示角色)
  renderByType('char');
  // 执行入场动画
  startExitAnimation();
}

// 核心切换逻辑
window.switchType = function(type) {
  if(currentType === type) return;
  currentType = type;
  // UI 按钮状态
  document.getElementById('btnTypeChar').classList.toggle('active', type === 'char');
  document.getElementById('btnTypeWeapon').classList.toggle('active', type === 'weapon');
  // 重新渲染
  renderByType(type);
}

function renderByType(type) {
  const poolSelector = document.getElementById('poolSelector');
  poolSelector.innerHTML = '';
  // 确定当前使用的数据源
  const dataMap = (type === 'char') ? globalCharData : globalWeaponData;
  // 如果没有数据
  if(!dataMap || Object.keys(dataMap).length === 0) {
    poolSelector.innerHTML = '<div style="color:#666; padding:10px;">// NO DATA RECORDS FOUND</div>';
    clearDisplay();
    return;
  }
  // 重置当前选中的池子为第一个
  currentPool = Object.keys(dataMap)[0];
  // 创建池子按钮
  createPoolButtons(dataMap);
  // 更新主显示区
  updateDisplay(dataMap, currentPool);
  // 更新表头
  const thEl = document.getElementById('thName');
  if (thEl) {
    thEl.textContent = (type === 'char') ? "CHARACTER" : "WEAPON";
  }
}

function createPoolButtons(dataMap) {
  const poolSelector = document.getElementById('poolSelector');
  const fragment = document.createDocumentFragment();
  Object.keys(dataMap).forEach((poolName, index) => {
    const button = document.createElement("button");
    button.className = "pool-btn";
    button.textContent = poolName;
    if (index === 0) button.classList.add("active");
    button.addEventListener("click", () => {
      currentPool = poolName;
      document.querySelectorAll(".pool-btn").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      updateDisplay(dataMap, currentPool);
    });
    fragment.appendChild(button);
  });
  poolSelector.appendChild(fragment);
}

function clearDisplay() {
  if (gachaChartInstance) {
    gachaChartInstance.destroy();
    gachaChartInstance = null;
  }
  document.getElementById("chartContainer").innerHTML = "";
  document.getElementById("rareCharsContainer").innerHTML = "";
  document.getElementById("summaryStrip").innerHTML = "";
  document.getElementById("historyTableBody").innerHTML = "";
}

function updateDisplay(dataMap, poolName) {
  if (!poolName || !dataMap || !dataMap[poolName]) return;

  // 渲染各个模块
  createChart(dataMap, poolName);
  createRareCharsCard(dataMap, poolName);
  createSummaryStrip(dataMap, poolName);
  createHistoryTable(dataMap, poolName);
}

// 获取通用名称 (处理 CharName 和 WeaponName 的差异)
function getItemName(item) {
  return item.charName || item.weaponName || "UNKNOWN";
}

function createSummaryStrip(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const poolUpCharConfig = {
    "熔火灼痕": "莱万汀",
  };
  const reversed = items.slice().reverse();

  let currentPity = 0;
  for(let item of reversed) {
    if(item.rarity === 6) {
      currentPity = 0;
    } else if (!item.isFree) {
      currentPity++;
    }
  }

  let centerLabel = "POOL TOTAL // 总抽取数";
  let centerValueHtml = items.length;
  let rightCornerSub = (currentType === 'char') ? "6★ GUARANTEED AT 80" : "UP 6★ GUARANTEED AT 80";
  let centerColor = "#ffffff";
  let pityCount = (currentType === 'char') ? 80 : 40;
  const targetUpChar = poolUpCharConfig[poolName];
  if (currentType === 'char' && targetUpChar) {
    centerLabel = "POOL SPARK // 本池垫刀";
    rightCornerSub = "LIMITED SPARK COUNT";
    let sparkCount = 0;
    let sparkConsumed  = false;

    for(let item of reversed) {
      if (!item.isFree) {
        sparkCount++;
      }
      const name = getItemName(item);
      if (name === targetUpChar && !item.isFree) {
        if (sparkCount <= 120) {
          sparkConsumed = true;
        }
      }
    }

    let targetLimit = 120;
    if (sparkCount >= 240) {
      targetLimit = 240;
      rightCornerSub = "MAX SPARK REACHED";
      centerColor = (sparkCount === 240) ? "#ff5252" : "#ffffff";
    } else if (sparkCount > 120) {
      targetLimit = 240;
      rightCornerSub = "NEXT TARGET: 240";
    } else {
      if (sparkConsumed) {
        targetLimit = 240;
        rightCornerSub = "120 CONSUMED -> TARGET 240";
      } else {
        targetLimit = 120;
      }
    }

    if (sparkCount >= targetLimit && targetLimit > 0) {
      centerColor = "#ff5252";
    } else {
      centerColor = "var(--ef-yellow)";
    }

    centerValueHtml = `${sparkCount} <span style="font-size:12px;color:#666">/ ${targetLimit}</span>`;
  }

  let nextProb = 0.8;
  let pityColor = "var(--ef-yellow)";
  let pitySubText = "SINCE LAST 6★";
  if (currentPity >= 65 && poolName !== "基础寻访") {
    pityColor = "#ff5722";
    let extraRate = (currentPity - 64) * 5; // 65抽开始抬概率
    nextProb = 0.8 + extraRate;
    if (nextProb > 100) nextProb = 100;
    pitySubText = `NEXT PROB: ${nextProb}%`;
  }

  const total = items.length;
  const sixStarCount = items.filter(i => i.rarity === 6).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  const typeLabel = (currentType === 'char') ? "CHARACTERS" : "WEAPONS";
  document.getElementById('summaryStrip').innerHTML = `
        <div class="info-card">
            <div class="info-label">CURRENT PITY // 当前水位</div>
            <div class="info-value" style="color:${pityColor}">
                ${currentPity} <span style="font-size:12px;color:#666">/ ${pityCount}</span>
            </div>
            <div class="info-sub">${pitySubText}</div>
        </div>
        
        <div class="info-card">
            <div class="info-label">${centerLabel}</div>
            <div class="info-value" style="color:${centerColor}">
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
}

// 分页逻辑
let currentHistoryPage = 1;
const historyPageSize = 10;
let currentHistoryData = [];
let currentPoolNameForPagination = "";

function createHistoryTable(dataMap, poolName) {
  if (currentPoolNameForPagination !== poolName) {
    currentHistoryPage = 1;
    currentPoolNameForPagination = poolName;
  }
  const items = dataMap[poolName];
  currentHistoryData = items.slice();
  renderHistoryPage();
}

function renderHistoryPage() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';
  const totalItems = currentHistoryData.length;
  const totalPages = Math.ceil(totalItems / historyPageSize) || 1;

  if (currentHistoryPage < 1) currentHistoryPage = 1;
  if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;

  const startIndex = (currentHistoryPage - 1) * historyPageSize;
  const endIndex = Math.min(startIndex + historyPageSize, totalItems);
  const pageItems = currentHistoryData.slice(startIndex, endIndex);

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#444;">NO DATA AVAILABLE</td></tr>`;
  } else {
    pageItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      const displayNum = totalItems - (startIndex + index);
      const name = getItemName(item);
      const isFree = item.isFree ? "YES" : "NO";

      tr.innerHTML = `
                <td style="color:#444; font-size:10px;">${String(displayNum).padStart(2, '0')}</td>
                <td class="rarity-${item.rarity}">${name}</td>
                <td>${"★".repeat(item.rarity)}</td>
                <td style="color:#444; font-size:10px;">[ ${currentPoolNameForPagination} ]</td>
                <td style="color:#444; font-size:10px;">${isFree}</td>
            `;
      tbody.appendChild(tr);
    });
  }
  document.getElementById('pageIndicator').textContent = `PAGE ${currentHistoryPage} / ${totalPages}`;
  document.getElementById('prevPageBtn').disabled = (currentHistoryPage === 1);
  document.getElementById('nextPageBtn').disabled = (currentHistoryPage === totalPages || totalPages === 0);
}

window.changePage = function(delta) {
  currentHistoryPage += delta;
  renderHistoryPage();
}

function createChart(dataMap, poolName) {
  const items = dataMap[poolName];
  const rarityCounts = {4: 0, 5: 0, 6: 0 };
  items.forEach(item => { if (rarityCounts[item.rarity] !== undefined) rarityCounts[item.rarity] += 1; });

  // 如果实例存在，直接更新数据并重绘，绝不触碰 DOM
  if (gachaChartInstance) {
    gachaChartInstance.data.datasets[0].data = [rarityCounts[4], rarityCounts[5], rarityCounts[6]];
    gachaChartInstance.update(); // 平滑过渡动画
    return;
  }

  const chartContainer = document.getElementById("chartContainer");
  chartContainer.innerHTML = '';

  // 装饰
  const corner = document.createElement("div");
  corner.style.cssText = "position:absolute; top:-1px; left:-1px; width:10px; height:10px; border-top:2px solid #fffa00; border-left:2px solid #fffa00; z-index:10;";
  chartContainer.appendChild(corner);
  const ctx = document.createElement("canvas");
  ctx.style.maxWidth = "280px"; ctx.style.maxHeight = "280px";
  chartContainer.appendChild(ctx);

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["4★", "5★", "6★"],
      datasets: [{
        data: [rarityCounts[4], rarityCounts[5], rarityCounts[6]],
        backgroundColor: ["#9c27b0", "#ffca28", "#ff5722"],
        borderColor: "#191919",
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: "bottom", labels: { color: "#fff", font: { family: 'Consolas' }, boxWidth: 10, padding: 10 } },
        title: { display: false }
      }
    }
  });
}

function createRareCharsCard(dataMap, poolName) {
  const items = dataMap[poolName];
  const sixStarItems = [];
  items.forEach(item => {
    if (item.rarity === 6) {
      sixStarItems.push(getItemName(item));
      if (sixStarItems.length > 12) sixStarItems.shift();
    }
  });

  const container = document.getElementById("rareCharsContainer");
  container.style.padding = "24px";

  const labelText = (currentType === 'char') ? "RECENT 6★ CHARACTERS" : "RECENT 6★ WEAPONS";

  const chipsHtml = sixStarItems.map(name => `<span style="display: inline-block; border: 1px solid #ff5722; color: #ff5722; background: rgba(255, 87, 34, 0.1); padding: 4px 10px; margin: 4px; font-size: 12px; font-weight: bold; font-family: 'Consolas';">${name}</span>`).join("");
  const emptyHtml = `<span style="color:#444; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;

  container.innerHTML = `
        <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:#fffa00;"></div>
        <div style="margin-left: 8px;">
            <div style="font-size:10px; color:#666; font-family:'Consolas'; letter-spacing:1px; margin-bottom:4px;">TARGET POOL IDENTIFIED</div>
            <div style="font-size:18px; font-weight:bold; color:#fffa00; margin-bottom:12px; font-family:'Consolas'; text-transform:uppercase;">${poolName}</div>
            <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #333; padding-bottom:12px; margin-bottom:12px;">
                <div style="font-size:12px; color:#fff;">TOTAL RECORDS:</div>
                <div style="font-size:20px; color:#fff; font-weight:bold;">${items.length}</div>
            </div>
            <div>
                <div style="font-size:10px; color:#666; margin-bottom:8px; font-family:'Consolas';">// ${labelText}</div>
                <div style=" display:flex; flex-wrap:wrap; margin-left:-4px;">${sixStarItems.length > 0 ? chipsHtml : emptyHtml}</div>
            </div>
        </div>
    `;
}

function startExitAnimation() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const loadingTrack = document.querySelector('.tech-progress-track');
  const logoWrapper = document.querySelector('.logo-wrapper');

  if(loadingTrack) loadingTrack.style.opacity = "0";

  setTimeout(() => {
    loadingText.style.transition = "all 0.5s ease-in"; loadingText.style.opacity = "0"; loadingText.style.transform = "translateY(-20px)";
    if(logoWrapper) { logoWrapper.style.transition = "all 0.5s ease-in"; logoWrapper.style.opacity = "0"; logoWrapper.style.transform = "scale(0.5)"; }

    setTimeout(() => {
      loadingOverlay.style.transition = "transform 0.6s cubic-bezier(0.8, 0, 0.2, 1)"; loadingOverlay.style.transform = "translateY(-100%)";
      setTimeout(() => {
        loadingOverlay.style.display = "none";

        const elements = [
          document.querySelector(".main-title"),
          document.getElementById("typeSwitcher"),
          document.getElementById("poolSelectorWrapper"),
          document.getElementById("summaryStrip"),
          document.getElementById("dashboardPanel"),
          document.getElementById("historySection")
        ];

        elements.forEach((el) => {
          if(el) {
            if(el.id === 'summaryStrip' || el.id === 'dashboardPanel' || el.id === 'typeSwitcher') el.style.display = 'flex';
            else el.style.display = 'block';
            el.style.opacity = "0"; el.style.transform = "translateY(20px)";
          }
        });

        // 此时数据已经准备好，动画展示出来
        elements.forEach((el, index) => {
          if(el) { setTimeout(() => { el.style.transition = "all 0.5s ease-out"; el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, index * 100); }
        });
      }, 500);
    }, 400);
  }, 400);
}

window.resetToAnalyze = function() {
  // === 1. UI 界面复位 (从 APP 界面切回 登录界面) ===
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = "none";
  loadingOverlay.style.transform = "";

  // 隐藏APP内部的DOM
  document.querySelector(".main-title").style.display = "none";
  document.getElementById("typeSwitcher").style.display = "none";
  document.getElementById("poolSelectorWrapper").style.display = "none";
  document.getElementById("summaryStrip").style.display = "none";
  document.getElementById("dashboardPanel").style.display = "none";
  document.getElementById("historySection").style.display = "none";

  // 显示登录卡片
  const analyzeContainer = document.getElementById("analyzeContainer");
  analyzeContainer.style.display = "flex";
  void analyzeContainer.offsetWidth;
  analyzeContainer.style.opacity = "1";

  // === 2. 按钮状态复位 ===
  // 无论是在“选择服务器”界面取消，还是报错退回，都强制显示“初始按钮组”
  const serverSelectArea = document.getElementById("serverSelectArea");
  if (serverSelectArea) serverSelectArea.style.display = "none";

  const defaultBtnGroup = document.getElementById("defaultBtnGroup");
  if (defaultBtnGroup) defaultBtnGroup.style.display = "block";

  // 确保主按钮文字正常
  const btn = document.getElementById("analyzeBtn");
  if(btn) {
    btn.textContent = "ONLINE INITIALIZE";
    btn.disabled = false;
  }

  // 清空报错
  const errDiv = document.getElementById("analyzeError");
  if (errDiv) errDiv.textContent = "";
}


