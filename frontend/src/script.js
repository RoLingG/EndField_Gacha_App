// script.js
import {
  LoadGachaTokens,
  CheckLocalFiles,
  GetCharacterData,
  GetWeaponData,
  ReloadFrontend,
  ExportData,
  ImportTemporaryJson,
  OpenOfficialLoginWindow,
  WindowClose,
  WindowMinSize,
  WindowToggleMaxSize,
  OpenDataFolder,
  LoadLocalGachaHistory,
  LoginAndFetchPlayers,
  SyncDataByChoice,
  UpdatePoolConfig,
  GetPoolConfig,
} from "../wailsjs/go/main/App";

// chart.js全局配置
Chart.defaults.color = '#ffffff';
Chart.defaults.borderColor = '#333333';
Chart.defaults.font.family = "'Consolas', 'Monaco', monospace";
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

// 默认是在线模式
window.isOfflineSelection = false;
// 窗口顶部栏双按钮逻辑处理
window.handleOpenFolder = async () => await OpenDataFolder();
window.handleReload = async () => await ReloadFrontend();

let currentUid = "";
let currentServerType = "";
window.handleExport = async function() {
  // 防止用户还没加载数据就点击导出
  if (!currentServerType) {
    mdui.snackbar({
      message: "请先加载数据 (Please Initialize Data First)",
      position: 'top'
    });
    return;
  }
  try {
    const result = await ExportData(currentUid, currentServerType);
    if (result === "success") {
      mdui.snackbar({
        message: `[SUCCESS] 导出成功 / Export Completed`,
        position: 'top',
        textColor: '#fffa00'
      });
    } else if (result === "cancelled") {
      console.log("User cancelled export");
    }
  } catch (err) {
    console.error(err);
    mdui.alert({
      headline: 'EXPORT ERROR',
      description: "导出失败: " + err,
      confirmText: 'OK'
    });
  }
}

let cachedHgToken = ""; // 暂存前端用户发送的短 Token
// 点击 WEB TOKEN SYNC 按钮，显示输入界面
window.showTokenInputUI = function() {
  document.getElementById("defaultBtnGroup").style.display = "none";
  document.getElementById("analyzeDescription").style.display = "none";
  document.getElementById("logModeTips").style.display = "none";
  document.getElementById("tokenInputArea").style.display = "block";
  document.getElementById("webTokenInput").focus();
  document.getElementById("analyzeError").textContent = "";
}

// 处理官方登录窗口按钮点击
window.handleOfficialLoginWindow = async function() {
  const btn = document.getElementById("btnLoginWindow");
  const originalText = btn.textContent;
  btn.textContent = "WAITING FOR LOGIN...";
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";
  try {
    const res = await OpenOfficialLoginWindow();
    console.log("Login Success:", res);
    cachedHgToken = res.hgToken;
    if (res.players && res.players.length === 1) {
      await doTokenSync(res.players[0]);
    } else {
      renderPlayerList(res.players);
      document.getElementById("tokenInputArea").style.display = "none";
      document.getElementById("playerSelectArea").style.display = "block";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("analyzeError").textContent = "LOGIN CANCELLED / FAILED";
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// 点击 CONNECT 按钮，执行第一步登录
window.handleToken = async function() {
  const input = document.getElementById("webTokenInput");
  const token = input.value.trim();
  if (!token) {
    document.getElementById("analyzeError").textContent = "ERR: TOKEN_EMPTY // 请输入 Token";
    return;
  }

  // 锁定界面
  input.disabled = true;
  const btn = document.getElementById("btnManualConnect"); // 给按钮加了个ID方便获取
  const orgText = btn.textContent;
  btn.textContent = "CONNECTING...";
  try {
    const res = await LoginAndFetchPlayers(token);
    cachedHgToken = res.hgToken;
    // 如果只有一个角色，直接自动进入下一步
    if (res.players && res.players.length === 1) {
      await doTokenSync(res.players[0]);
      return;
    }
    // 如果有多个角色，渲染列表
    renderPlayerList(res.players);
    // 切换 UI 到选择界面
    document.getElementById("tokenInputArea").style.display = "none";
    document.getElementById("playerSelectArea").style.display = "block";
  } catch (err) {
    console.error(err);
    document.getElementById("analyzeError").textContent = "LOGIN ERR: " + err;
    resetToAnalyze();
    input.disabled = false;
    btn.textContent = orgText;
  }
}

// 渲染角色列表
function renderPlayerList(players) {
  const container = document.getElementById("playerListContainer");
  container.innerHTML = "";

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player-card";
    div.innerHTML = `
            <div class="player-info">
                <span class="p-name">${p.nickName} <span style="font-size:10px;color:#888;">Lv.${p.level}</span></span>
                <span class="p-uid">UID: ${p.uid}</span>
            </div>
            <div class="p-tag" style="border-color: ${p.channelName === "官服" ? 'var(--ef-yellow)' : '#23ade5'}; color: ${p.channelName === "官服" ? 'var(--ef-yellow)' : '#23ade5'}">
                ${p.channelName === "官服" ? "OFFICIAL" : "BILIBILI"}
            </div>
        `;
    div.onclick = () => doTokenSync(p);
    container.appendChild(div);
  });
}

// 执行最终同步
async function doTokenSync(player) {
  document.getElementById("tokenInputArea").style.display = "none";
  document.getElementById("playerSelectArea").style.display = "none";
  const serverName = player.serverType;
  currentServerType = serverName; // 更新全局变量，方便导出功能使用
  showLoadingState("SYSTEM SYNCHRONIZING...", `UID: ${player.uid} // ${serverName.toUpperCase()}`);
  try {
    const res = await SyncDataByChoice(cachedHgToken, player.uid, serverName);
    if (res === "success") {
      setTimeout(async () => {
        await initApp(true, serverName, player.uid);
      }, 1000);
    }
  } catch (err) {
    console.error(err);
    document.getElementById("analyzeError").textContent = "SYNC ERR: " + err;
    resetToAnalyze();
  }
}

// 全局数据存储
let globalCharData = null;
let globalWeaponData = null;
let currentType = 'char'; // 'char' | 'weapon'
let currentPool = null;
let gachaChartInstance = null; // 图表实例复用

// 更新卡池配置（可选功能，可以在设置中调用）
window.updatePoolConfig = async function() {
  try {
    let msg = await UpdatePoolConfig();
    globalPoolConfig = null; // 清除缓存
    await loadPoolConfig(); // 重新加载
    mdui.snackbar({
      message: msg,
      position: 'top',
      textColor: '#fffa00'
    });
  } catch (err) {
    console.error("Failed to update pool config:", err);
    mdui.snackbar({
      message: "更新失败 / Update failed: " + err,
      position: 'top'
    });
  }
}

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
    currentServerType = serverName;
  }
}

// 在线分析逻辑处理
window. analyze = async function () {
  const btn = document.getElementById("analyzeBtn");
  const originalText = btn.textContent;

  btn.textContent = "CHECKING SIGNALS...";
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";

  try {
    const tokens = await LoadGachaTokens();
    const hasOfficial = tokens.Official && tokens.Official.length > 0;
    const hasBilibili = tokens.Bilibili && tokens.Bilibili.length > 0;

    if (!hasOfficial && !hasBilibili) {
      throw "NO TOKEN DETECTED // 未找到抽卡记录链接";
    }

    // 双服逻辑
    if (hasOfficial && hasBilibili) {
      // 此时界面还完全显示着，只需要切换内部的按钮区域
      document.getElementById("defaultBtnGroup").style.display = "none";
      document.getElementById("serverSelectArea").style.display = "block";

      // 恢复按钮状态，以便下次取消回来时正常
      btn.textContent = originalText;
      btn.disabled = false;
      return; // 停在这里等待用户点击选择
    }

    // 单服逻辑
    let targetServer = "official";
    if (hasBilibili) targetServer = "bilibili";

    // 恢复按钮
    btn.textContent = originalText;
    btn.disabled = false;

    showLoadingState("SYSTEM SYNCHRONIZING...", `TARGET CONFIRMED: ${targetServer.toUpperCase()}`);
    await initApp(false, targetServer, "");

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
    const archives = await CheckLocalFiles();
    console.log("Local Archives:", archives);
    if (!archives || archives.length === 0) {
      throw "NO LOCAL ARCHIVES FOUND // 未找到本地历史记录";
    }
    // 只有一个存档，且该存档只有一个服务器数据 -> 直接加载
    if (archives.length === 1 && archives[0].servers.length === 1) {
      const targetArchive = archives[0];
      const targetServer = targetArchive.servers[0]; // "official" or "bilibili"
      const targetUid = targetArchive.uid;
      btn.textContent = originalText;
      btn.disabled = false;
      window.isOfflineSelection = true;
      showLoadingState("LOADING LOCAL ARCHIVE...", `UID: ${targetUid} // ${targetServer.toUpperCase()}`);
      await initApp(true, targetServer, targetUid);
      return;
    }
    // 有多个存档，或者一个存档有双服数据 -> 显示选择界面
    renderLocalArchiveList(archives);
    document.getElementById("defaultBtnGroup").style.display = "none";
    document.getElementById("logModeTips").style.display = "none";
    document.getElementById("playerSelectArea").style.display = "block";
    const desc = document.querySelector("#playerSelectArea .analyze-important-desc");
    if(desc) desc.innerHTML = "> LOCAL ARCHIVES FOUND // 发现本地存档<br>> SELECT DATA SOURCE // 请选择要加载的记录";
    btn.textContent = originalText;
    btn.disabled = false;
  } catch (err) {
    console.error(err);
    btn.textContent = originalText;
    btn.disabled = false;
    document.getElementById("analyzeError").textContent = "ERR: " + err;
  }
}
// 渲染本地存档列表
function renderLocalArchiveList(archives) {
  const container = document.getElementById("playerListContainer");
  container.innerHTML = "";
  archives.forEach(arc => {
    arc.servers.forEach(server => {
      const div = document.createElement("div");
      div.className = "player-card";
      // 格式化时间戳，去掉多余的字符看起来更整洁
      let displayTime = arc.timestamp;
      if (displayTime.length > 10) displayTime = displayTime.replace("_", " ");
      div.innerHTML = `
            <div class="player-info">
                <span class="p-name">UID: ${arc.uid}</span>
                <span class="p-uid" style="color:#888;">DATE: ${displayTime}</span>
            </div>
            <div class="p-tag" style="border-color: ${server === 'official' ? 'var(--ef-yellow)' : '#23ade5'}; color: ${server === 'official' ? 'var(--ef-yellow)' : '#23ade5'}">
                ${server.toUpperCase()}
            </div>
        `;
      div.onclick = () => {
        doLocalLoad(arc.uid, server);
      };
      container.appendChild(div);
    });
  });
}
// 执行选中的本地加载
async function doLocalLoad(uid, serverName) {
  document.getElementById("playerSelectArea").style.display = "none";
  window.isOfflineSelection = true;
  currentServerType = serverName;
  showLoadingState("LOADING LOCAL DATABASE...", `TARGET: UID ${uid} // ${serverName.toUpperCase()}`);
  try {
    await initApp(true, serverName, uid);
  } catch (err) {
    console.error(err);
    resetToAnalyze();
    document.getElementById("analyzeError").textContent = "LOAD ERR: " + err;
  }
}

// 临时导入浏览 (不落盘)
window.handleImportTemp = async function() {
  try {
    const res = await ImportTemporaryJson();
    showLoadingState("ANALYZING EXTERNAL DATA...", `TYPE: ${res.type.toUpperCase()} // TEMPORARY VIEW`);
    let rawList = JSON.parse(res.jsonData);
    if (!Array.isArray(rawList)) {
      if (rawList.list) rawList = rawList.list;
      else rawList = [];
    }
    const groupedData = groupDataByPool(rawList);
    if (res.type === 'char') {
      globalCharData = groupedData;
      globalWeaponData = {};
      currentType = 'char';
    } else {
      globalWeaponData = groupedData;
      globalCharData = {};
      currentType = 'weapon';
    }
    const exportBtn = document.getElementById("btnExportExcel");
    if(exportBtn) exportBtn.style.display = "none";
    setTimeout(() => {
      const loadingText = document.querySelector('.loading-text');
      if(loadingText) loadingText.textContent = 'DATA PARSED SUCCESS';
      const btnChar = document.getElementById('btnTypeChar');
      const btnWeapon = document.getElementById('btnTypeWeapon');
      if(btnChar) btnChar.classList.toggle('active', res.type === 'char');
      if(btnWeapon) btnWeapon.classList.toggle('active', res.type === 'weapon');
      renderByType(res.type);
      startExitAnimation();
      currentServerType = "imported_temp";
      currentUid = "temp_file";
    }, 600);
  } catch (err) {
    console.error(err);
    if (err && !err.toString().includes("cancelled")) {
      mdui.snackbar({
        message: "Import Failed: " + err,
        position: 'top'
      });
    }
    resetToAnalyze();
  }
}

async function initApp(isOfflineMode, serverName = "official", uid = "") {
  currentUid = uid;
  const loadingText = document.querySelector('.loading-text');

  let charDataGrouped, weaponDataGrouped;
  if (isOfflineMode) {
    // 离线模式
    loadingText.textContent = 'READING LOCAL FILES...';
    const dataStruct = await LoadLocalGachaHistory(uid, serverName);
    charDataGrouped = JSON.parse(dataStruct.char || "{}");
    weaponDataGrouped = JSON.parse(dataStruct.weapon || "{}");
  } else {
    // 在线模式：先获取数据
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

  // 获取数据后再更新卡池配置
  try {
    await window.updatePoolConfig();
  } catch (err) {
    console.warn("Auto-update pool config failed:", err);
  }

  // 加载卡池配置
  await loadPoolConfig();

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
  currentHistoryPage = 1
  // UI 按钮状态
  document.getElementById('btnTypeChar').classList.toggle('active', type === 'char');
  document.getElementById('btnTypeWeapon').classList.toggle('active', type === 'weapon');
  // 重新渲染
  renderByType(type);
}

function renderByType(type) {
  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');

  // 确定当前使用的数据源
  const dataMap = (type === 'char') ? globalCharData : globalWeaponData;

  // 如果没有数据
  if(!dataMap || Object.keys(dataMap).length === 0) {
    if (poolSelectorWrapper) {
      poolSelectorWrapper.innerHTML = '<div style="color:#666; padding:10px;">// NO DATA RECORDS FOUND</div>';
    }
    const pageInfo = document.getElementById('pageIndicator');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if(pageInfo) pageInfo.textContent = "PAGE 0 / 0";
    if(prevBtn) prevBtn.disabled = true;
    if(nextBtn) nextBtn.disabled = true;
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

// 白天模式
let globalTheme = "night"
const themeStorageKey = "ef-theme";

function applyTheme(theme) {
  const body = document.body;
  const btn = document.getElementById("themeToggle");
  if (!body || !btn) return;
  const rootStyle = document.documentElement.style;
  let chartTextColor, chartBorderColor;
  if (theme === "day") {
    globalTheme = "day"
    body.classList.add("theme-day");
    btn.textContent = "[ MODE: DAY ]";
    rootStyle.setProperty("--ef-accent", "#d9b500");
    rootStyle.setProperty("--ef-text-strong", "#1f1f1f");
    rootStyle.setProperty("--ef-text-muted", "#777");
    rootStyle.setProperty("--ef-divider", "#cfcfc7");
    rootStyle.setProperty("--ef-empty", "#777");
    rootStyle.setProperty("--ef-chip-border", "#d45a2a");
    rootStyle.setProperty("--ef-chip-text", "#d45a2a");
    rootStyle.setProperty("--ef-chip-bg", "rgba(212, 90, 42, 0.12)");
    chartTextColor = "#1f1f1f";
    chartBorderColor = "#333333";
  } else {
    globalTheme = "night"
    body.classList.remove("theme-day");
    btn.textContent = "[ MODE: NIGHT ]";
    rootStyle.setProperty("--ef-accent", "#fffa00");
    rootStyle.setProperty("--ef-text-strong", "#cccccc");
    rootStyle.setProperty("--ef-text-muted", "#666");
    rootStyle.setProperty("--ef-divider", "#333");
    rootStyle.setProperty("--ef-empty", "#444");
    rootStyle.setProperty("--ef-chip-border", "#ff5722");
    rootStyle.setProperty("--ef-chip-text", "#ff5722");
    rootStyle.setProperty("--ef-chip-bg", "rgba(255, 87, 34, 0.1)");
    chartTextColor = "#ffffff";
    chartBorderColor = "#333333";
  }
  Chart.defaults.color = chartTextColor;
  Chart.defaults.borderColor = chartBorderColor;
  if (gachaChartInstance) {
    gachaChartInstance.destroy();
    gachaChartInstance = null;
  }

  if (currentPool) {
    const dataMap = (currentType === 'char') ? globalCharData : globalWeaponData;
    if (dataMap && dataMap[currentPool]) {
      createChart(dataMap, currentPool);
    }
  }
}

(function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const saved = localStorage.getItem(themeStorageKey) || "night";
  applyTheme(saved);

  btn.addEventListener("click", () => {
    const next = document.body.classList.contains("theme-day") ? "night" : "day";
    localStorage.setItem(themeStorageKey, next);
    applyTheme(next);
    if (typeof window.onThemeChanged === "function") {
      window.onThemeChanged(next);
    }
  });
})();

function createPoolButtons(dataMap) {
  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (!poolSelectorWrapper) {
    console.warn('poolSelectorWrapper element not found');
    return;
  }
  poolSelectorWrapper.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'pool-select-container';

  const label = document.createElement('label');
  label.className = 'pool-select-label';
  label.textContent = 'SELECT POOL //';
  container.appendChild(label);

  // 创建下拉菜单容器
  const dropdown = document.createElement('div');
  dropdown.className = 'pool-dropdown-wrapper';

  const pools = Object.keys(dataMap);
  currentPool = pools[0];

  // 显示当前选中的池子
  const display = document.createElement('div');
  display.className = 'pool-display';
  display.textContent = currentPool;
  display.addEventListener('click', () => {
    menu.classList.toggle('show');
  });
  dropdown.appendChild(display);

  // 下拉菜单列表
  const menu = document.createElement('div');
  menu.className = 'pool-menu';

  pools.forEach((poolName) => {
    const item = document.createElement('div');
    item.className = 'pool-menu-item';
    item.textContent = poolName;
    if (poolName === currentPool) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => {
      // 更新显示
      display.textContent = poolName;
      currentPool = poolName;
      // 更新菜单项状态
      document.querySelectorAll('.pool-menu-item').forEach(i => {
        i.classList.remove('active');
      });
      item.classList.add('active');
      // 关闭菜单
      menu.classList.remove('show');
      // 更新显示
      updateDisplay(dataMap, currentPool);
    });
    menu.appendChild(item);
  });

  // 根据层级组合菜单
  dropdown.appendChild(menu);
  container.appendChild(dropdown);
  poolSelectorWrapper.appendChild(container);

  // 点击外部关闭菜单
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      menu.classList.remove('show');
    }
  });
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

// 全局卡池配置缓存
let globalPoolConfig = null;

// 加载卡池配置
async function loadPoolConfig() {
  if (globalPoolConfig) return globalPoolConfig;
  try {
    const config = await GetPoolConfig();
    if (config && config.pools && config.pools.length > 0) {
      globalPoolConfig = {};
      config.pools.forEach(pool => {
        globalPoolConfig[pool.poolName] = pool.up6Name;
      });
    }
  } catch (err) {
    console.warn("Failed to load pool config, using fallback:", err);
    // 使用默认配置作为后备
    globalPoolConfig = {
      "熔火灼痕": "莱万汀",
      "轻飘飘的信使": "洁尔佩塔",
      "热烈色彩": "伊冯",
    };
  }
  return globalPoolConfig;
}

function createSummaryStrip(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const poolUpCharConfig = globalPoolConfig
  const reversed = items.slice().reverse();

  let currentPity = 0;
  for(let item of reversed) {
    if(item.rarity === 6 && !item.isFree) {
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
  items.forEach(item => {
    if (rarityCounts[item.rarity] !== undefined) rarityCounts[item.rarity] += 1;
  });
  if (gachaChartInstance) {
    gachaChartInstance.data.datasets[0].data = [rarityCounts[4], rarityCounts[5], rarityCounts[6]];
    gachaChartInstance.update();
    return;
  }
  const chartContainer = document.getElementById("chartContainer");
  chartContainer.innerHTML = '';
  const corner = document.createElement("div");
  corner.style.cssText = "position:absolute; top:-1px; left:-1px; width:10px; height:10px; border-top:2px solid var(--ef-accent); border-left:2px solid var(--ef-accent); z-index:10;";
  chartContainer.appendChild(corner);

  const ctx = document.createElement("canvas");
  ctx.style.maxWidth = "280px"; ctx.style.maxHeight = "280px";
  chartContainer.appendChild(ctx);
  gachaChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["4★", "5★", "6★"],
      datasets: [{
        data: [rarityCounts[4], rarityCounts[5], rarityCounts[6]],
        backgroundColor: ["#9c27b0", "#ffca28", "#ff5722"],
        borderColor: Chart.defaults.borderColor,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: "bottom", labels: { font: { family: 'Consolas' }, boxWidth: 10, padding: 10 } },
        title: { display: false }
      }
    }
  });
}

function createRareCharsCard(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const chronological = items.slice().reverse();
  const sixStarDetails = [];
  let currentPityCounter = 0;
  chronological.forEach(item => {
    const isFree = item.isFree === true;

    if (item.rarity === 6) {
      if (isFree) {
        sixStarDetails.push({
          name: getItemName(item),
          isNew: item.isNew,
          pityText: "FREE"
        });
      } else {
        currentPityCounter++;
        sixStarDetails.push({
          name: getItemName(item),
          isNew: item.isNew,
          pityText: currentPityCounter
        });
        currentPityCounter = 0;
      }
    } else {
      if (!isFree) currentPityCounter++;
    }
  });

  const recentSixStars = sixStarDetails.slice();
  const container = document.getElementById("rareCharsContainer");
  container.style.padding = "24px";
  const accentColor = "var(--ef-accent)";
  const textStrong = "var(--ef-text-strong)";
  const textMuted = "var(--ef-text-muted)";
  const emptyColor = "var(--ef-empty)";
  const chipBorderColor = "var(--ef-chip-border)";
  const chipTextColor = "var(--ef-chip-text)";
  const chipBgColor = "var(--ef-chip-bg)";
  const labelText = (currentType === 'char') ? "RECENT 6★ CHARACTERS" : "RECENT 6★ WEAPONS";

  // 获取当前卡池的UP角色
  const upCharName = globalPoolConfig && globalPoolConfig[poolName] ? globalPoolConfig[poolName] : null;

  const chipsHtml = recentSixStars.map(item => {
    // 判断是否是UP角色
    const isUpChar = upCharName && item.name === upCharName;
    const isNewChar = item.isNew

    // 根据是否是UP角色设置不同的颜色
    let borderColor, textColor, bgColor, hasGlowEffect = false;
    if (isUpChar && isNewChar) {
      // UP + New：使用荧光渐变效果
      borderColor = chipBorderColor;
      textColor = chipTextColor;
      bgColor = chipBgColor;
      hasGlowEffect = true;
    } else if (isUpChar) {
      // UP角色使用原有颜色
      borderColor = chipBorderColor;
      textColor = chipTextColor;
      bgColor = chipBgColor;
    } else if (isNewChar) {
      borderColor = "#e8a035";
      textColor = "#e8a035";
      bgColor = "rgba(255, 235, 59, 0.15)";
    } else {
      // 非UP角色使用灰色调
      borderColor = "#666666";
      textColor = "#888888";
      bgColor = "#66666619";
    }

    const styleStr = `display: inline-block; border: 1px solid ${borderColor}; color: ${textColor};
    background: ${bgColor}; padding: 4px 10px; margin: 4px; font-size: 12px; font-weight: bold; font-family: 'Consolas';`;
    const glowClass = hasGlowEffect ? 'class="glow-up-new"' : '';
    return `<span ${glowClass} style="${styleStr}">${item.name} [${item.pityText}]</span>`;
  }).join("");

  const emptyHtml = `<span style="color:${emptyColor}; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;

  container.innerHTML = `
        <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${accentColor};"></div>
        <div style="margin-left: 8px;">
            <div style="font-size:10px; color:${textMuted}; font-family:'Consolas'; letter-spacing:1px; margin-bottom:4px;">TARGET POOL IDENTIFIED</div>
            <div style="font-size:18px; font-weight:bold; color:${accentColor}; margin-bottom:12px; font-family:'Consolas'; text-transform:uppercase;">${poolName}</div>
            
            <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #777; padding-bottom:12px; margin-bottom:12px;">
                <div style="font-size:16px; font-weight: bold; color:${textStrong};">TOTAL RECORDS:</div>
                <div style="font-size:16px; font-weight: bold; color:${textStrong}; font-weight:bold;">${items.length}</div>
            </div>
            
            <div>
                <div style="font-size:10px; color:${textMuted}; margin-bottom:8px; font-family:'Consolas';">// ${labelText}</div>
                <div style="display:flex; flex-wrap:wrap; margin-left:-4px;">
                    ${recentSixStars.length > 0 ? chipsHtml : emptyHtml}
                </div>
            </div>
        </div>
    `;
}

function startExitAnimation() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const loadingTrack = document.querySelector('.tech-progress-track');
  const logoWrapper = document.querySelector('.logo-wrapper');

  if (loadingTrack) {
    loadingTrack.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease";
    loadingTrack.style.transform = "scaleX(0)";
    loadingTrack.style.opacity = "0";
  }

  setTimeout(() => {
    if(loadingText) {
      loadingText.style.transition = "all 0.5s ease-in";
      loadingText.style.opacity = "0";
      loadingText.style.transform = "translateY(-20px)";
    }
    if(logoWrapper) {
      logoWrapper.style.transition = "all 0.5s ease-in";
      logoWrapper.style.opacity = "0";
      logoWrapper.style.transform = "scale(0.5)";
    }
    setTimeout(() => {
      loadingOverlay.style.transition = "transform 0.6s cubic-bezier(0.8, 0, 0.2, 1)";
      loadingOverlay.style.transform = "translateY(-100%)";

      setTimeout(() => {
        loadingOverlay.style.display = "none";
        if(loadingTrack) {
          loadingTrack.style.transition = "none";
          loadingTrack.style.transform = "scaleX(1)";
          loadingTrack.style.opacity = "1";
        }
        if(logoWrapper) logoWrapper.style.transform = "";
        if(loadingText) loadingText.style.transform = "";
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
        // 依次执行入场动画
        elements.forEach((el, index) => {
          if(el) { setTimeout(() => { el.style.transition = "all 0.5s ease-out"; el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, index * 100); }
        });
      }, 500);
    }, 400);
  }, 400);
}

window.resetToAnalyze = function() {
  // UI 界面复位 (从 APP 界面切回 登录界面)
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

  // 按钮状态复位
  document.getElementById("serverSelectArea").style.display = "none";

  // 隐藏 Token 相关界面
  document.getElementById("tokenInputArea").style.display = "none";
  document.getElementById("playerSelectArea").style.display = "none";

  // 恢复显示日志模式的提示
  const adTips = document.getElementById("analyzeDescription")
  if(adTips) adTips.style.display = "block";
  const logTips = document.getElementById("logModeTips");
  if(logTips) logTips.style.display = "block";

  // 复位输入框
  const input = document.getElementById("webTokenInput");
  if(input) {
    input.value = "";
    input.disabled = false;
  }
  const officialBtn = document.getElementById("btnLoginWindow");
  if(officialBtn) {
    officialBtn.textContent = "CONNECT (OFFICIAL)";
    officialBtn.disabled = false;
  }

  // 显示默认按钮组
  const defaultBtnGroup = document.getElementById("defaultBtnGroup");
  if (defaultBtnGroup) defaultBtnGroup.style.display = "block";
  // 恢复 analyze 按钮
  const btn = document.getElementById("analyzeBtn");
  if(btn) {
    btn.textContent = "ONLINE INITIALIZE (LOG)";
    btn.disabled = false;
  }

  // 恢复 local 按钮
  const localBtn = document.getElementById("localBtn");
  if(localBtn) {
    localBtn.textContent = "LOCAL INITIALIZE";
    localBtn.disabled = false;
  }

  // 清空报错
  const errDiv = document.getElementById("analyzeError");
  if (errDiv) errDiv.textContent = "";
}
