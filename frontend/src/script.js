import {
  RefreshCharGachaHistory,
  RefreshWeaponGachaHistory,
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
    const container = document.getElementById('loginContainer');
    if (container) container.classList.add('show');
  }, 100);
});

// 全局数据存储
let globalCharData = null;
let globalWeaponData = null;
let currentType = 'char'; // 'char' | 'weapon'
let currentPool = null;

// 登录入口
window.login = async function () {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = "flex"; loadingOverlay.style.opacity = "1"; loadingOverlay.style.transform = "translateY(0)";
  const loginContainer = document.getElementById("loginContainer"); loginContainer.style.opacity = "0"; setTimeout(() => loginContainer.style.display = "none", 500);

  try { await initApp(); } catch (err) {
    console.error(err);
    document.getElementById("loginError").textContent = "ERR: " + err;
    resetToLogin();
  }
};

async function initApp() {
  const loadingText = document.querySelector('.loading-text');
  loadingText.textContent = 'SYSTEM SYNCHRONIZING...';

  // 并行获取角色和武器数据
  // 如果武器数据获取失败（比如没点过武器历史），我们应该允许容错，不要让整个APP崩溃
  const p1 = RefreshCharGachaHistory().then(res => JSON.parse(res));
  const p2 = RefreshWeaponGachaHistory().then(res => JSON.parse(res)).catch(err => {
    console.warn("Weapon data load failed:", err);
    return {}; // 返回空对象，避免报错
  });

  const [charData, weaponData] = await Promise.all([p1, p2]);

  globalCharData = charData;
  globalWeaponData = weaponData;

  loadingText.textContent = 'DATA STREAM RECEIVED';

  // 初始化显示 (默认显示角色)
  renderByType('char');

  // 执行入场动画
  startExitAnimation();
}

// === 核心切换逻辑 ===
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
    poolSelector.appendChild(button);
  });
}

function clearDisplay() {
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
    } else {
      currentPity++;
    }
  }

  let centerLabel = "POOL TOTAL // 总抽取数";
  let centerValueHtml = items.length;
  let centerSub = "RECORDS LOGGED";
  let centerColor = "#ffffff";
  const targetUpChar = poolUpCharConfig[poolName];
  if (currentType === 'char' && targetUpChar) {
    centerLabel = "POOL SPARK // 本池垫刀";
    centerSub = "LIMITED SPARK COUNT";

    let sparkCount = 0;
    for(let item of reversed) {
      const name = getItemName(item);
      if (name === targetUpChar) {
        sparkCount = 0
      } else {
        sparkCount++;
      }
    }
    if (sparkCount >= 120) {
      centerColor = "#ff5252";
      sparkCount = sparkCount % 120;
    } else {
      centerColor = "var(--ef-yellow)";
    }

    centerValueHtml = `${sparkCount} <span style="font-size:12px;color:#666">/ 120</span>`;
  }

  let nextProb = 2;
  let pityColor = "var(--ef-yellow)";
  let pitySubText = "SINCE LAST 6★";
  if (currentPity >= 65) {
    pityColor = "#ff5722";
    let extraRate = (currentPity - 64) * 5;
    nextProb = 2 + extraRate;
    if (nextProb > 100) nextProb = 100;
    pitySubText = `NEXT PROB: ~${nextProb}%`;
  }

  const total = items.length;
  const sixStarCount = items.filter(i => i.rarity === 6).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  const typeLabel = (currentType === 'char') ? "CHARACTERS" : "WEAPONS";
  document.getElementById('summaryStrip').innerHTML = `
        <div class="info-card">
            <div class="info-label">CURRENT PITY // 当前水位</div>
            <div class="info-value" style="color:${pityColor}">
                ${currentPity} <span style="font-size:12px;color:#666">/ 80</span>
            </div>
            <div class="info-sub">${pitySubText}</div>
        </div>
        
        <div class="info-card">
            <div class="info-label">${centerLabel}</div>
            <div class="info-value" style="color:${centerColor}">
                ${centerValueHtml}
            </div>
            <div class="info-sub">${centerSub}</div>
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
      const name = getItemName(item); // 使用通用名称获取

      tr.innerHTML = `
                <td style="color:#444; font-size:10px;">${String(displayNum).padStart(2, '0')}</td>
                <td class="rarity-${item.rarity}">${name}</td>
                <td>${"★".repeat(item.rarity)}</td>
                <td style="color:#444; font-size:10px;">[ ${currentPoolNameForPagination} ]</td>
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

  const chartContainer = document.getElementById("chartContainer");
  chartContainer.innerHTML = ''; // Clear old canvas

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
                <div style="display:flex; flex-wrap:wrap; margin-left:-4px;">${sixStarItems.length > 0 ? chipsHtml : emptyHtml}</div>
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
    if(logoWrapper) { logoWrapper.style.transition = "all 0.5s ease-in"; logoWrapper.style.opacity = "0"; logoWrapper.style.transform = "scale(0.8)"; }

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

function resetToLogin() {
  const loadingOverlay = document.getElementById("loadingOverlay"); loadingOverlay.style.display = "none"; loadingOverlay.style.transform = "";
  document.querySelector(".main-title").style.display = "none";
  document.getElementById("typeSwitcher").style.display = "none";
  document.getElementById("poolSelectorWrapper").style.display = "none";
  document.getElementById("summaryStrip").style.display = "none";
  document.getElementById("dashboardPanel").style.display = "none";
  document.getElementById("historySection").style.display = "none";
  const loginContainer = document.getElementById("loginContainer"); loginContainer.style.display = "flex"; void loginContainer.offsetWidth; loginContainer.style.opacity = "1";
}
