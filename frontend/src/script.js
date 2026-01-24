import {
  RefreshGachaHistory,
  ReloadFrontend,
  WindowClose,
  WindowMinSize,
  WindowToggleMaxSize,
} from "../wailsjs/go/main/App";

Chart.defaults.color = '#ffffff';
Chart.defaults.borderColor = '#333333';
Chart.defaults.font.family = "'Consolas', 'Monaco', monospace";

window.handleReload = async () => await ReloadFrontend();

const maxBtn = document.getElementById("maxBtn");
maxBtn.onclick = async () => {
  const isMax = await WindowToggleMaxSize();
  maxBtn.textContent = isMax ? "❐" : "□";
};
document.getElementById("minBtn").onclick = () => WindowMinSize();
document.getElementById("closeBtn").onclick = () => WindowClose();

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const container = document.getElementById('loginContainer');
    if (container) container.classList.add('show');
  }, 100);
});

window.login = async function () {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = "flex"; loadingOverlay.style.opacity = "1"; loadingOverlay.style.transform = "translateY(0)";
  const bar = document.querySelector('.tech-progress-bar'); if(bar) { bar.style.background = ""; bar.style.boxShadow = ""; }
  const loginContainer = document.getElementById("loginContainer"); loginContainer.style.opacity = "0"; setTimeout(() => loginContainer.style.display = "none", 500);

  try { await initApp(); } catch (err) { document.getElementById("loginError").textContent = "ERR: " + err; resetToLogin(); }
};

let globalUpdateDisplayFn = null;

async function initApp() {
  const loadingText = document.querySelector('.loading-text');
  loadingText.textContent = 'SYSTEM SYNCHRONIZING...';
  loadingText.style.color = '#fffa00';

  const poolSelector = document.getElementById('poolSelector');
  const chartContainer = document.getElementById('chartContainer');
  const rareCharsContainer = document.getElementById('rareCharsContainer');
  const summaryStrip = document.getElementById('summaryStrip');
  const historyTableBody = document.getElementById('historyTableBody');

  poolSelector.innerHTML = ''; chartContainer.innerHTML = ''; rareCharsContainer.innerHTML = ''; summaryStrip.innerHTML = ''; historyTableBody.innerHTML = '';

  let data = null;
  let currentPool = null;

  try {
    const json = await RefreshGachaHistory();
    data = JSON.parse(json);
    loadingText.textContent = 'DATA STREAM RECEIVED';

    createPoolButtons(data);

    if (Object.keys(data).length > 0) currentPool = Object.keys(data)[0];

    globalUpdateDisplayFn = (poolName) => {
      const targetPool = poolName || currentPool;
      if(data && targetPool) {
        updateDisplay(data, targetPool);
        const btns = document.querySelectorAll(".pool-btn");
        btns.forEach(btn => { if(btn.textContent === targetPool) btn.classList.add("active"); else btn.classList.remove("active"); });
      }
    };

    startExitAnimation(data, currentPool);

  } catch (error) { console.error(error); handleLoadError(); }

  function createPoolButtons(dataMap) {
    poolSelector.innerHTML = "";
    Object.keys(dataMap).forEach((poolName, index) => {
      const button = document.createElement("button");
      button.className = "pool-btn"; button.textContent = poolName;
      if (index === 0) button.classList.add("active");
      button.addEventListener("click", () => {
        currentPool = poolName;
        document.querySelectorAll(".pool-btn").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        updateDisplay(dataMap, currentPool);
      });
      poolSelector.appendChild(button);
    });
  }
}

function updateDisplay(dataMap, poolName) {
  if (!poolName || !dataMap || !dataMap[poolName]) return;
  document.getElementById("chartContainer").innerHTML = "";
  document.getElementById("rareCharsContainer").innerHTML = "";

  createChart(dataMap, poolName);
  createRareCharsCard(dataMap, poolName);
  createSummaryStrip(dataMap, poolName);
  createHistoryTable(dataMap, poolName);
}

function createSummaryStrip(dataMap, poolName) {
  const items = dataMap[poolName];
  const total = items.length;
  // 计算当前水位 (Pity)
  // 规则：80抽硬保底
  let pity = 0;
  let last6StarIndex = -1;
  // 倒序查找最近的一个6星
  for(let i = items.length - 1; i >= 0; i--) {
    if(items[i].rarity === 6) {
      last6StarIndex = i;
      break;
    }
  }
  // 计算垫刀数
  pity = (last6StarIndex === -1) ? total : (items.length - 1 - last6StarIndex);
  // 软保底逻辑 (Soft Pity)
  // 规则：65抽开始，概率每抽提升5%
  let pityColor = "var(--ef-yellow)"; // 默认黄色
  let pitySubText = "SINCE LAST 6★";   // 默认文案

  if (pity >= 65) {
    pityColor = "#ff5722"; // 超过65抽变橙红色，警示状态
    // 计算当前理论概率: 基础2% + (当前水位 - 64) * 5%
    const currentRate = 2 + (pity - 64) * 5;
    // 限制最高显示 100%
    pitySubText = `RATE UP: ${Math.min(currentRate, 100)}%`;
  }
  // 计算总出货率
  const sixStarCount = items.filter(i => i.rarity === 6).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  // 限定池 120 井 (Spark) 逻辑
  let totalColor = "#ffffff";
  if (total >= 120) totalColor = "var(--ef-yellow)";
  document.getElementById('summaryStrip').innerHTML = `
        <div class="info-card">
            <div class="info-label">CURRENT PITY // 当前水位</div>
            <div class="info-value" style="color:${pityColor}">
                ${pity} <span style="font-size:12px;color:#666">/ 80</span>
            </div>
            <div class="info-sub">${pitySubText}</div>
        </div>
        
        <div class="info-card">
            <div class="info-label">POOL TOTAL // 本池累计</div>
            <div class="info-value" style="color:${totalColor}">
                ${total} <span style="font-size:12px;color:#666">/ 120</span>
            </div>
            <div class="info-sub">LIMITED SPARK COUNT</div>
        </div>
        
        <div class="info-card">
            <div class="info-label">6★ RATIO // 出货率</div>
            <div class="info-value">${rate}%</div>
            <div class="info-sub">${sixStarCount} OPERATORS</div>
        </div>
    `;
}

// 分页状态变量
let currentHistoryPage = 1;
const historyPageSize = 10; // 每页显示10条
let currentHistoryData = []; // 存储当前池子的完整历史数据
let currentPoolNameForPagination = ""; // 存储当前池子名称

function createHistoryTable(dataMap, poolName) {
  // 1. 如果切换了池子，重置页码为 1
  if (currentPoolNameForPagination !== poolName) {
    currentHistoryPage = 1;
    currentPoolNameForPagination = poolName;
  }
  const items = dataMap[poolName];
  // 2. 保存反转后的完整数据（最新的在前面），供分页使用
  currentHistoryData = items.slice().reverse();

  renderHistoryPage();
}

// 渲染当前页数据的函数
function renderHistoryPage() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';
  const totalItems = currentHistoryData.length;
  const totalPages = Math.ceil(totalItems / historyPageSize) || 1;
  // 确保页码不越界
  if (currentHistoryPage < 1) currentHistoryPage = 1;
  if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;
  // 计算切片索引
  const startIndex = (currentHistoryPage - 1) * historyPageSize;
  const endIndex = Math.min(startIndex + historyPageSize, totalItems);

  const pageItems = currentHistoryData.slice(startIndex, endIndex);
  // 渲染行
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#444;">NO DATA AVAILABLE</td></tr>`;
  } else {
    pageItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      const displayNum = startIndex + index + 1;
      tr.innerHTML = `
                <td style="color:#444; font-size:10px;">${String(displayNum).padStart(2, '0')}</td>
                <td class="rarity-${item.rarity}">${item.charName}</td>
                <td>${"★".repeat(item.rarity)}</td>
                <td style="color:#444; font-size:10px;">[ ${currentPoolNameForPagination} ]</td>
            `;
      tbody.appendChild(tr);
    });
  }
  // 更新分页控件 UI
  document.getElementById('pageIndicator').textContent = `PAGE ${currentHistoryPage} / ${totalPages}`;

  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  prevBtn.disabled = (currentHistoryPage === 1);
  nextBtn.disabled = (currentHistoryPage === totalPages || totalPages === 0);
}

window.changePage = function(delta) {
  currentHistoryPage += delta;
  renderHistoryPage();
}

function createChart(dataMap, poolName) {
  const items = dataMap[poolName];
  const rarityCounts = { 4: 0, 5: 0, 6: 0 };
  items.forEach(item => { if (rarityCounts[item.rarity] !== undefined) rarityCounts[item.rarity] += 1; });

  const chartContainer = document.getElementById("chartContainer");
  // 装饰角标 (放到左上角)
  const corner = document.createElement("div");
  corner.style.cssText = "position:absolute; top:-1px; left:-1px; width:10px; height:10px; border-top:2px solid #fffa00; border-left:2px solid #fffa00; z-index:10;";
  chartContainer.appendChild(corner);

  const ctx = document.createElement("canvas");
  ctx.style.maxWidth = "300px"; ctx.style.maxHeight = "300px";
  chartContainer.appendChild(ctx);

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["4★", "5★", "6★"],
      datasets: [{
        label: poolName,
        data: [rarityCounts[4], rarityCounts[5], rarityCounts[6]],
        backgroundColor: ["#9c27b0", "#ffca28", "#ff5722"],
        borderColor: "#191919",
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: {
        legend: { position: "bottom", labels: { color: "#fff", font: { family: 'Consolas' }, boxWidth: 10, padding: 15 } },
        title: { display: true, text: `[ DISTRIBUTION ]`, color: "#fffa00", font: { size: 16, weight: 'bold', family: 'Consolas' }, padding: { bottom: 20 } }
      }
    }
  });
}

function createRareCharsCard(dataMap, poolName) {
  const items = dataMap[poolName];
  const sixStarChars = [];
  items.forEach(item => { if (item.rarity === 6) { sixStarChars.push(item.charName); if (sixStarChars.length > 12) sixStarChars.shift(); } });

  const container = document.getElementById("rareCharsContainer");
  // 使用 padding 撑开内部
  container.style.padding = "24px";

  const chipsHtml = sixStarChars.map(name => `<span style="display: inline-block; border: 1px solid #ff5722; color: #ff5722; background: rgba(255, 87, 34, 0.1); padding: 4px 10px; margin: 4px; font-size: 12px; font-weight: bold; font-family: 'Consolas';">${name}</span>`).join("");
  const emptyHtml = `<span style="color:#444; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;

  container.innerHTML = `
        <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:#fffa00;"></div> <!-- 左侧黄色竖条 (装饰) -->
        <div style="margin-left: 8px;">
            <div style="font-size:10px; color:#666; font-family:'Consolas'; letter-spacing:1px; margin-bottom:4px;">TARGET POOL IDENTIFIED</div>
            <div style="font-size:18px; font-weight:bold; color:#fffa00; margin-bottom:12px; font-family:'Consolas';">${poolName}</div>
            <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #333; padding-bottom:12px; margin-bottom:12px;">
                <div style="font-size:12px; color:#fff;">TOTAL RECORDS:</div>
                <div style="font-size:20px; color:#fff; font-weight:bold;">${items.length}</div>
            </div>
            <div>
                <div style="font-size:10px; color:#666; margin-bottom:8px; font-family:'Consolas';">// RECENT 6★ LOGS</div>
                <div style="display:flex; flex-wrap:wrap; margin-left:-4px;">${sixStarChars.length > 0 ? chipsHtml : emptyHtml}</div>
            </div>
        </div>
    `;
}

function startExitAnimation(data, currentPool) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const loadingTrack = document.querySelector('.tech-progress-track');
  const logoWrapper = document.querySelector('.logo-wrapper');

  if(loadingTrack) loadingTrack.style.opacity = "0";

  setTimeout(() => {
    loadingText.style.transition = "all 0.5s ease-in"; loadingText.style.opacity = "0"; loadingText.style.transform = "translateY(-20px)";
    if(logoWrapper) { logoWrapper.style.transition = "all 0.5s ease-in"; logoWrapper.style.opacity = "0"; logoWrapper.style.transform = "scale(0.8)"; }

    setTimeout(() => {
      loadingOverlay.style.transition = "transform 0.6s cubic-bezier(0.8, 0, 0.2, 1)"; loadingOverlay.style.transform = "translateY(-100%)";
      setTimeout(() => {
        loadingOverlay.style.display = "none";

        const elements = [
          document.querySelector(".main-title"),
          document.getElementById("poolSelectorWrapper"),
          document.getElementById("summaryStrip"),
          document.getElementById("dashboardPanel"), // 改为 ID dashboardPanel
          document.getElementById("historySection")
        ];

        elements.forEach((el) => {
          if(el) {
            if(el.id === 'summaryStrip' || el.id === 'dashboardPanel') el.style.display = 'flex';
            else el.style.display = 'block';
            el.style.opacity = "0"; el.style.transform = "translateY(20px)";
          }
        });

        if (data && currentPool) updateDisplay(data, currentPool);

        elements.forEach((el, index) => {
          if(el) { setTimeout(() => { el.style.transition = "all 0.5s ease-out"; el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, index * 100); }
        });
      }, 500);
    }, 400);
  }, 400);
}

function handleLoadError() {
  document.querySelector('.loading-text').textContent = "CONNECTION FAILED";
  document.querySelector('.loading-text').style.color = "#ff3333";
  const bar = document.querySelector('.tech-progress-bar'); if(bar) { bar.style.background = "repeating-linear-gradient(45deg, #ff4444, #ff4444 10px, #cc0000 10px, #cc0000 20px)"; }
  setTimeout(resetToLogin, 2500);
}

function resetToLogin() {
  const loadingOverlay = document.getElementById("loadingOverlay"); loadingOverlay.style.display = "none"; loadingOverlay.style.transform = "";
  const logoWrapper = document.querySelector('.logo-wrapper'); if(logoWrapper) { logoWrapper.style.opacity = "1"; logoWrapper.style.transform = ""; }
  document.querySelector(".main-title").style.display = "none";
  document.getElementById("poolSelectorWrapper").style.display = "none";
  document.getElementById("summaryStrip").style.display = "none";
  document.getElementById("dashboardPanel").style.display = "none";
  document.getElementById("historySection").style.display = "none";
  const loginContainer = document.getElementById("loginContainer"); loginContainer.style.display = "flex"; void loginContainer.offsetWidth; loginContainer.style.opacity = "1";
}