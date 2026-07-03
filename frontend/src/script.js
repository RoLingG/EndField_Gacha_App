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
  DeleteLocalGachaHistory,
  LoginAndFetchPlayers,
  SyncDataByChoice,
  UpdatePoolConfig,
  GetPoolConfig,
  CancelCurrentOperation
} from "../wailsjs/go/main/App";

// mdui Snackbar封装
function showAppSnackbar({
                           message = "",
                           type = "info",
                           autoCloseDelay = 3200,
                           closeable = false,
                         } = {}) {
  const snackbar = document.createElement("mdui-snackbar");
  snackbar.className = `app-snackbar app-snackbar--${type}`;
  snackbar.textContent = message;
  snackbar.autoCloseDelay = SNACKBAR_AUTO_CLOSE;
  snackbar.closeable = closeable;
  document.body.appendChild(snackbar);
  snackbar.open = true;
  const cleanup = () => {
    if (snackbar.parentNode) snackbar.remove();
  };
  snackbar.addEventListener("closed", cleanup, { once: true });
  snackbar.addEventListener("close", () => {
    setTimeout(cleanup, 300);
  }, { once: true });
  return snackbar;
}

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
  window.runtime.EventsOff('fetch-progress');
  window.runtime.EventsOn('fetch-progress', (message) => {
    const subtextElement = document.querySelector('.loading-subtext');
    if (subtextElement) {
      subtextElement.textContent = message;
    }
  });
});

// 默认是在线模式
window.isOfflineSelection = false;
// 窗口顶部栏双按钮逻辑处理
window.handleOpenFolder = async () => await OpenDataFolder();
window.handleReload = async () => {
  if (window.runtime && window.runtime.EventsOff) {
    window.runtime.EventsOff('fetch-progress');
  }
  document.querySelectorAll('mdui-dialog').forEach(dialog => {
    dialog.open = false;
    dialog.remove();
  });
  if (window.Chart && window.Chart.instances) {
    Object.values(window.Chart.instances).forEach(chart => {
      if (chart && chart.destroy) {
        chart.destroy();
      }
    });
  }
  window.isFetching = false;
  await ReloadFrontend();
};

let currentUid = "";
let currentServerType = "";
window.isFetching = false

window.handleCancelFetch = async function() {
  if (!window.isFetching) return;

  // 创建自定义样式的 MDUI 对话框
  const dialog = document.createElement('mdui-dialog');
  dialog.headline = '// CONFIRM CANCELLATION';
  dialog.description = '> 确定要取消当前操作吗？已抓取的数据将会丢失。';
  dialog.innerHTML = `
    <mdui-button slot="action" variant="text" class="dialog-cancel-btn">
      [ CANCEL / 取消 ]
    </mdui-button>
    <mdui-button slot="action" variant="tonal" class="dialog-confirm-btn">
      [ CONFIRM / 确定 ]
    </mdui-button>
  `;
  document.body.appendChild(dialog);
  dialog.open = true;
  // 取消按钮
  dialog.querySelector('.dialog-cancel-btn').onclick = () => {
    dialog.open = false;
  };
  // 确定按钮
  dialog.querySelector('.dialog-confirm-btn').onclick = async () => {
    dialog.open = false;
    try {
      await CancelCurrentOperation();
      showAppSnackbar({
        message: "[CANCELLED] 操作已取消 / Operation Canceled",
        type: "warning"
      });
    } catch (err) {
      console.error(err);
      showAppSnackbar({
        message: "[ERROR] 操作取消失败: " + err,
        type: "error",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
    }
    setFetchingState(false);
  };
  // 对话框关闭时清理
  dialog.addEventListener('closed', () => {
    setTimeout(() => dialog.remove(), 300);
  });
};

window.handleExport = async function() {
  // 防止用户还没加载数据就点击导出
  if (!currentServerType) {
    showAppSnackbar({
      message: "[WARNING] 请先加载数据 (Please Initialize Data First)",
      type: "warning"
    });
    return;
  }
  try {
    const result = await ExportData(currentUid, currentServerType);
    if (result === "success") {
      showAppSnackbar({
        message: "[SUCCESS] 导出成功 / Export Completed",
        type: "success"
      });
    } else if (result === "cancelled") {
      console.log("User cancelled export");
    }
  } catch (err) {
    console.error(err);
    showAppSnackbar({
      message: "[ERROR] 导出失败: " + err,
      type: "error",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    });
  }
}

let cachedHgToken = ""; // 暂存前端用户发送的短 Token
// 点击 WEB TOKEN SYNC 按钮，显示输入界面
window.showTokenInputUI = function() {
  document.getElementById("defaultBtnGroup").style.display = "none";
  document.getElementById("analyzeDescription").style.display = "none";
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
    showAppSnackbar({
      message: "[ERROR] 处理 Token 失败: " + err,
      type: "error",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    });
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
  setFetchingState(true);
  try {
    const res = await SyncDataByChoice(cachedHgToken, player.uid, serverName);
    if (res === "success") {
      setTimeout(async () => {
        await initApp(true, serverName, player.uid);
      }, 1000);
    }
  } catch (err) {
    setFetchingState(false);
    console.error(err);
    document.getElementById("analyzeError").textContent = "SYNC ERR: " + err;
    resetToAnalyze();
  }
}

// 全局数据存储
let globalCharData = null;
let globalWeaponData = null;
let currentType = 'char'; // 'char' | 'weapon' | 'all'
let lastDataType = 'char';  // 保存上次选择的数据类型（char 或 weapon），用于汇总模式
let currentPool = null;
let currentAllPoolsData = null;  // 存储合并后的汇总数据
let isAllPoolsMode = false;  // 标识是否在汇总模式
let gachaChartInstance = null; // 图表实例复用
// 需要参与入场/出场动画的 APP 主内容元素 ID
const APP_ELEMENT_IDS = ["mainTitle", "typeSwitcher", "poolSelectorWrapper", "summaryStrip", "dashboardPanel", "historySection"];

// 游戏机制常量
const JADE_PER_PULL = 500;           // 1抽 = 500嵌晶玉
const JADE_PER_STONE = 75;           // 1衍质原石 = 75嵌晶玉
const WEAPON_QUOTA_PER_TEN = 1980;   // 10连武器 = 1980配额
const SPARK_TIER1 = 120;             // 垫刀第一阶段阈值
const SPARK_TIER2 = 240;             // 垫刀第二阶段阈值
const PITY_BOOST_START = 65;         // 概率提升起始抽数

// UI 常量
const SNACKBAR_AUTO_CLOSE = 4500;    // snackbar 自动关闭延迟 (ms)

// 更新卡池配置（可选功能，可以在设置中调用）
window.updatePoolConfig = async function() {
  try {
    let msg = await UpdatePoolConfig();
    globalPoolConfig = null; // 清除缓存
    await loadPoolConfig(); // 重新加载
    showAppSnackbar({
      message: "[SUCCESS] " + msg,
      type: "success"
    });
  } catch (err) {
    console.error("Failed to update pool config:", err);
    showAppSnackbar({
      message: "[ERROR] 更新失败 / Update failed: " + err,
      type: "error",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
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

function setFetchingState(fetching) {
  window.isFetching = fetching;
  const btn = document.getElementById("btnCancelFetch");
  if (btn) btn.style.display = fetching ? "inline-block" : "none";
}

function showLoadingState(mainText, subText) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  // 更新文本内容
  document.querySelector('.loading-text').textContent = mainText;
  document.querySelector('.loading-subtext').textContent = subText;
  // 隐藏分析容器
  const analyzeContainer = document.getElementById("analyzeContainer");
  analyzeContainer.style.opacity = "0";
  analyzeContainer.style.display = "none";
  // 显示加载动画
  requestAnimationFrame(() => {
    loadingOverlay.classList.add("show");
  });
}

// 双服选择逻辑处理
window.onSelectServer = async function(serverName) {
  // 启动全屏 Loading
  const actionText = window.isOfflineSelection ? "LOADING ARCHIVE" : "TARGET LOCKED";
  showLoadingState(actionText, `ACCESSING ${serverName.toUpperCase()} DATABASE...`);
  try {
    // 根据标志位决定调用哪个模式
    if (window.isOfflineSelection) {
      throw new Error("离线模式缺少 UID，请从本地存档列表中选择具体记录");
    } else {
      // 在线模式: false
      await initApp(false, serverName);
    }
    currentServerType = serverName;
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
    currentServerType = targetServer;

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
      let displayTime = arc.timestamp;
      if (displayTime.length > 10) displayTime = displayTime.replace("_", " ");

      div.innerHTML = `
            <div class="player-info">
                <span class="p-name">UID: ${arc.uid}</span>
                <span class="p-uid" style="color:#888;">DATE: ${displayTime}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <div class="p-tag" style="border-color: ${server === 'official' ? 'var(--ef-yellow)' : '#23ade5'}; color: ${server === 'official' ? 'var(--ef-yellow)' : '#23ade5'}">
                    ${server.toUpperCase()}
                </div>
                <div class="del-archive-btn" style="cursor: pointer; color: #888;" title="DELETE ARCHIVE / 删除该记录">×</div>
            </div>
        `;

      // 点击卡片本体加载数据
      div.onclick = () => {
        doLocalLoad(arc.uid, server).then(r => {});
      };

      // 删除按钮点击逻辑
      const deleteBtn = div.querySelector('.del-archive-btn');
      deleteBtn.onclick = (e) => {
        e.stopPropagation(); // 阻止冒泡，避免触发加载数据的 onclick

        const dialog = document.createElement('mdui-dialog');
        dialog.headline = '// CONFIRM DELETION';
        dialog.description = `> 确定要删除该本地记录吗？\n> 目标: UID ${arc.uid} (${displayTime})\n> 注意: 这将彻底删除该时间点的数据文件夹，操作无法撤销。`;
        dialog.innerHTML = `
          <mdui-button slot="action" variant="text" class="dialog-cancel-btn">
            [ CANCEL / 取消 ]
          </mdui-button>
          <mdui-button slot="action" variant="tonal" class="dialog-confirm-btn" style="--mdui-comp-button-tonal-container-color: rgba(255, 82, 82, 0.1); --mdui-comp-button-tonal-label-text-color: #ff5252;">
            [ DELETE / 确认删除 ]
          </mdui-button>
        `;
        document.body.appendChild(dialog);
        dialog.open = true;

        dialog.querySelector('.dialog-cancel-btn').onclick = () => {
          dialog.open = false;
        };

        dialog.querySelector('.dialog-confirm-btn').onclick = async () => {
          dialog.open = false;
          try {
            const folderName = `${arc.uid}_${arc.timestamp}`;
            await DeleteLocalGachaHistory(folderName);

            showAppSnackbar({
              message: "[SUCCESS] 存档已删除 / Archive Deleted",
              type: "success"
            });

            // 删除成功后，重新扫描并渲染列表
            await loadLocal();
          } catch (err) {
            console.error(err);
            showAppSnackbar({
              message: "[ERROR] 删除失败: " + err,
              type: "error",
              autoCloseDelay: SNACKBAR_AUTO_CLOSE,
            });
          }
        };

        dialog.addEventListener('closed', () => {
          setTimeout(() => dialog.remove(), 300);
        });
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
    setTimeout(async () => {
      const loadingText = document.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = 'DATA PARSED SUCCESS';
      await loadPoolConfig();
      const btnChar = document.getElementById('btnTypeChar');
      const btnWeapon = document.getElementById('btnTypeWeapon');
      if (btnChar) btnChar.classList.toggle('active', res.type === 'char');
      if (btnWeapon) btnWeapon.classList.toggle('active', res.type === 'weapon');
      renderByType(res.type);
      updateAllBtnText();
      startExitAnimation();
    }, 600);
  } catch (err) {
    console.error(err);
    if (err && !err.toString().includes("cancelled")) {
      showAppSnackbar({
        message: "[ERROR] Import Failed: " + err,
        type: "error",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
    }
    resetToAnalyze();
  }
}

async function initApp(isOfflineMode, serverName = "official", uid = "") {
  if (isOfflineMode) {
    currentUid = uid;
  } else {
    currentUid = "";
  }

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
    setFetchingState(true);

    let charRes = null;
    let weaponRes = null;
    let charList = [];
    let weaponList = [];
    let charFetchError = null;
    let weaponFetchError = null;
    try {
      charRes  = await GetCharacterData(serverName);
      charList = charRes?.list || [];
    } catch (e) {
      charFetchError = e;
      console.warn("Character data fetch failed:", e);
    }
    try {
      weaponRes = await GetWeaponData(serverName);
      weaponList = weaponRes?.list || [];
    } catch (e) {
      weaponFetchError = e;
      console.warn("Weapon data fetch failed:", e);
    }

    setFetchingState(false);

    if (charFetchError && weaponFetchError) {
      showAppSnackbar({
        message: `[ERROR] 角色池与武器池数据均加载失败: ${charFetchError} / ${weaponFetchError}。`,
        type: "error",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
      resetToAnalyze();
      return;
    }
    currentUid = charRes?.uid || weaponRes?.uid || "";
    if (charFetchError || weaponFetchError) {
      const warningMessages = [];
      if (charFetchError) {
        warningMessages.push("角色池数据加载失败，已降级为空数据");
      }
      if (weaponFetchError) {
        warningMessages.push("武器池数据加载失败，已降级为空数据");
      }
      showAppSnackbar({
        message: "[WARNING] " + warningMessages.join(" / "),
        type: "warning",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
    }
    charDataGrouped = groupDataByPool(charList);
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
  updateAllBtnText();
  // 执行入场动画
  startExitAnimation();
}

// 核心切换逻辑
window.switchType = function(type) {
  if(currentType === type) return;
  currentType = type;
  currentHistoryPage = 1
  // 如果不是汇总模式，保存当前的数据类型
  if (type !== 'all') {
    lastDataType = type;
  }
  // 更新汇总卡池标签
  updateAllBtnText()
  // UI 按钮状态
  document.getElementById('btnTypeChar').classList.toggle('active', type === 'char');
  document.getElementById('btnTypeWeapon').classList.toggle('active', type === 'weapon');
  document.getElementById('btnTypeAll').classList.toggle('active', type === 'all');
  // 隐藏/显示卡池选择器
  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (type === 'all') {
    isAllPoolsMode = true;
    if (poolSelectorWrapper) {
      poolSelectorWrapper.classList.add('pool-selector-hidden');
      poolSelectorWrapper.style.visibility = 'hidden';
      poolSelectorWrapper.style.height = '0';
      poolSelectorWrapper.style.overflow = 'hidden';
    }
  } else {
    isAllPoolsMode = false;
    if (poolSelectorWrapper) {
      poolSelectorWrapper.classList.remove('pool-selector-hidden');
      poolSelectorWrapper.style.visibility = 'visible';
      poolSelectorWrapper.style.height = '';
      poolSelectorWrapper.style.overflow = '';
    }
  }
  // 重新渲染
  renderByType(type);
}

function updateSummaryStripVisibility(visible) {
  const summaryStrip = document.getElementById('summaryStrip');
  if (!summaryStrip) return;
  summaryStrip.style.display = visible ? 'flex' : 'none';
}

// 统一渲染历史记录空状态
function renderEmptyHistoryTable(message, colspan = 5) {
  const historyTableBody = document.getElementById('historyTableBody');
  if (!historyTableBody) return;

  historyTableBody.innerHTML = `
    <tr>
      <td colspan="${colspan}" style="text-align:center; color:#666; padding:32px 0; font-weight:bold; font-size:16px;">
        ${message}
      </td>
    </tr>
  `;
}

// 统一更新历史记录分页区域 UI
function updateHistoryPaginationUI(currentPage, totalPages) {
  const pageInfo = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (pageInfo) pageInfo.textContent = `PAGE ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages || totalPages === 0);
}

// 统一渲染无数据主界面
function renderNoDataState({
                             poolMessage = '// NO DATA RECORDS FOUND',
                             chartMessage = '// NO CHART DATA',
                             detailTitle = '// NO DETAIL DATA',
                             detailDesc = '当前所选类型暂无可展示记录。<br>Please switch pool/type or load another archive.',
                             historyMessage = '// NO HISTORY RECORDS',
                             detailLabel = 'TARGET POOL UNAVAILABLE',
                             historyColspan = 4,
                             hidePoolSelector = false
                           } = {}) {
  // 清空旧显示内容和旧图表实例
  clearDisplay();
  // 重置状态，避免残留旧池子/汇总数据
  currentPool = null;
  currentAllPoolsData = null;
  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (poolSelectorWrapper) {
    if (hidePoolSelector) {
      poolSelectorWrapper.classList.add('pool-selector-hidden');
      poolSelectorWrapper.style.visibility = 'hidden';
      poolSelectorWrapper.style.height = '0';
      poolSelectorWrapper.style.overflow = 'hidden';
    } else {
      poolSelectorWrapper.classList.remove('pool-selector-hidden');
      poolSelectorWrapper.style.visibility = 'visible';
      poolSelectorWrapper.style.height = '';
      poolSelectorWrapper.style.overflow = '';
      poolSelectorWrapper.innerHTML = `
        <div style="color:#666; padding:10px; font-weight: bold; font-size: 18px;">
          ${poolMessage}
        </div>
      `;
    }
  }
  // 无数据时隐藏概览条
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

function renderByType(type) {
  // 汇总模式处理
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
    const dataMap = (lastDataType === 'char') ? globalCharData : globalWeaponData;
    if (!dataMap || Object.keys(dataMap).length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    // 合并所有卡池数据
    currentAllPoolsData = mergeAllPoolsData(dataMap);
    // 如果合并后依然为空，也按汇总无数据处理
    if (!currentAllPoolsData || currentAllPoolsData.length === 0) {
      renderNoDataState(allPoolsNoDataConfig);
      return;
    }
    // 汇总模式有数据时恢复概览条
    updateSummaryStripVisibility(true);
    // 使用汇总专用的显示函数
    displayAllPoolsSummary(currentAllPoolsData);
    return;
  }
  // 确定当前使用的数据源
  const dataMap = (type === 'char') ? globalCharData : globalWeaponData;
  // 如果没有数据
  if(!dataMap || Object.keys(dataMap).length === 0) {
    renderNoDataState({
      poolMessage: '// NO DATA RECORDS FOUND',
      chartMessage: '// NO CHART DATA',
      detailTitle: '// NO DETAIL DATA',
      detailDesc: '当前所选类型暂无可展示记录。<br>Please switch pool/type or load another archive.',
      historyMessage: '// NO HISTORY RECORDS',
      historyColspan: 5,
      hidePoolSelector: false
    });
    return;
  }
  // 如果有数据则恢复显示选择器
  updateSummaryStripVisibility(true);
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

  if (isAllPoolsMode && currentAllPoolsData) {
    // 汇总卡池模式
    updateOrCreateChart(currentAllPoolsData);
  } else if (currentPool) {
    // 单类型卡池模式
    const dataMap = (lastDataType === 'char') ? globalCharData : globalWeaponData;
    if (dataMap && dataMap[currentPool]) {
      updateOrCreateChart(dataMap[currentPool])
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

  // 按 globalPoolOrder 顺序过滤 dataMap 中存在的卡池
  const pools = globalPoolOrder.filter(poolName => poolName in dataMap);
  // 处理配置中不存在的卡池（以防万一）
  Object.keys(dataMap).forEach(poolName => {
    if (!pools.includes(poolName)) {
      pools.push(poolName);
    }
  });
  currentPool = pools[pools.length - 1];

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

  pools.reverse().forEach((poolName) => {
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
  // 清除嵌晶玉/衍质原石转换显示
  const currencyInfo = document.getElementById('currencyInfo');
  if (currencyInfo) {
    currencyInfo.style.display = 'none';
    document.getElementById('jadeValue').textContent = '0';
    document.getElementById('stoneValue').textContent = '0';
  }
}

function updateCurrencyDisplay(notFreeTotal, type) {
  const currencyInfo = document.getElementById('currencyInfo');
  const charCurrency = document.getElementById('charCurrency');
  const weaponCurrency = document.getElementById('weaponCurrency');
  if (!currencyInfo) return;

  currencyInfo.style.display = 'flex';
  if (type === 'char') {
    charCurrency.style.display = 'inline';
    weaponCurrency.style.display = 'none';
    const jadeVal = notFreeTotal * JADE_PER_PULL;
    const stoneVal = Math.floor(jadeVal / JADE_PER_STONE);
    document.getElementById('jadeValue').textContent = jadeVal.toLocaleString();
    document.getElementById('stoneValue').textContent = stoneVal.toLocaleString();
  } else {
    charCurrency.style.display = 'none';
    weaponCurrency.style.display = 'inline';
    const tenPulls = Math.floor(notFreeTotal / 10);
    const weaponQuota = tenPulls * WEAPON_QUOTA_PER_TEN;
    document.getElementById('weaponQuotaValue').textContent = weaponQuota.toLocaleString();
  }
}

function calculateSixStarDetails(items, reverse = false) {
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


function updateDisplay(dataMap, poolName) {
  if (!poolName || !dataMap || !dataMap[poolName]) return;
  // 渲染各个模块
  updateOrCreateChart(dataMap[poolName])
  createRareRecordCard(dataMap, poolName);
  createSummaryStrip(dataMap, poolName);
  createHistoryTable(dataMap, poolName);
}

// 获取通用名称 (处理 CharName 和 WeaponName 的差异)
function getItemName(item) {
  return item.charName || item.weaponName || "UNKNOWN";
}

// 全局卡池配置缓存
let globalPoolConfig = null;
// 全局卡池顺序列表（用于排序）
let globalPoolOrder = [];

// 加载卡池配置
async function loadPoolConfig() {
  if (globalPoolConfig) return globalPoolConfig;
  try {
    const config = await GetPoolConfig();
    if (config && config.pools && config.pools.length > 0) {
      globalPoolConfig = {};
      globalPoolOrder = [];
      config.pools.forEach(pool => {
        globalPoolConfig[pool.poolName] = pool.up6Name;
        globalPoolOrder.push(pool.poolName);
      });
    }
  } catch (err) {
    console.warn("Failed to load pool config, using fallback:", err);
    // 使用默认配置作为后备
    globalPoolConfig = {
      "熔火灼痕": "莱万汀",
      "轻飘飘的信使": "洁尔佩塔",
      "热烈色彩": "伊冯",
      "河流的女儿": "汤汤",
      "狼珀": "洛茜",
      "春雷动，万物生": "庄方宜",
      "拳出无悔": "弭弗",
      "逐罪者": "卡缪",
    };
    globalPoolOrder =
        ["熔火灼痕",
          "轻飘飘的信使",
          "热烈色彩",
          "河流的女儿",
          "狼珀",
          "春雷动，万物生",
          "拳出无悔",
          "逐罪者"
        ];
  }
  return globalPoolConfig;
}

function calculateSparkInfo(reversed, targetUpChar) {
  let sparkCount = 0;
  let sparkConsumed = false;
  for (let item of reversed) {
    if (!item.isFree) sparkCount++;
    const name = getItemName(item);
    if (name === targetUpChar && !item.isFree && sparkCount <= SPARK_TIER1) {
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

function calculatePityBoost(currentPity, poolName) {
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

function calculatePoolStats(items) {
  const total = items.length;
  const notFreeTotal = items.filter(item => !item.isFree).length;
  const sixStarCount = items.filter(i => i.rarity === 6).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  return { total, notFreeTotal, sixStarCount, rate };
}

function createSummaryStrip(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const poolUpCharConfig = globalPoolConfig || {};
  const reversed = items.slice().reverse();

  let currentPity = 0;
  for(let item of reversed) {
    if(item.rarity === 6 && !item.isFree) {
      currentPity = 0;
    } else if (!item.isFree) {
      currentPity++;
    }
  }

  const { total, notFreeTotal, sixStarCount, rate } = calculatePoolStats(items);

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

// 分页逻辑
let currentHistoryPage = 1;
const historyPageSize = 10;
let currentHistoryData = [];
let currentPoolNameForPagination = "";

// 统一渲染卡池历史记录分页
function renderPagedHistoryTable({
                                   items,
                                   isAllPoolsMode,
                                   getPoolLabel = () => 'UNKNOWN',
                                   emptyMessage = 'NO DATA AVAILABLE',
                                   emptyColspan = 5
                                 }) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / historyPageSize) || 1;
  if (currentHistoryPage < 1) currentHistoryPage = 1;
  if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;
  const startIndex = (currentHistoryPage - 1) * historyPageSize;
  const endIndex = Math.min(startIndex + historyPageSize, totalItems);
  const pageItems = items.slice(startIndex, endIndex);
  if (pageItems.length === 0) {
    renderEmptyHistoryTable(emptyMessage, emptyColspan);
  } else {
    pageItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      const displayNum = totalItems - (startIndex + index);
      const name = getItemName(item);
      const isFree = item.isFree ? "YES" : "NO";
      const poolLabel = getPoolLabel(item);
      tr.innerHTML = `
        <td style="color:#444; font-size:10px;">${String(displayNum).padStart(2, '0')}</td>
        <td class="rarity-${item.rarity}">${name}</td>
        <td>${"★".repeat(item.rarity)}</td>
        <td style="color:#444; font-size:10px;">[ ${poolLabel} ]</td>
        <td style="color:#444; font-size:10px;">${isFree}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  // 更新分页
  updateHistoryPaginationUI(currentHistoryPage, totalPages);
  // 初始化页码编辑功能
  initPageIndicatorEditing(totalPages, isAllPoolsMode);
}


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
  renderPagedHistoryTable({
    items: currentHistoryData,
    isAllPoolsMode: false,
    getPoolLabel: () => currentPoolNameForPagination,
    emptyMessage: 'NO DATA AVAILABLE',
    emptyColspan: 5
  });
}

window.changePage = function(delta) {
  currentHistoryPage += delta;
  if (isAllPoolsMode) {
    renderAllPoolsHistoryPage();
  } else {
    renderHistoryPage();
  }
}

// 初始化页码编辑功能（双击可编辑）
function initPageIndicatorEditing(totalPages, isAllPoolsMode) {
  const pageIndicator = document.getElementById('pageIndicator');
  if (!pageIndicator) return;

  // 移除之前的事件监听（防止重复绑定）
  const newPageIndicator = pageIndicator.cloneNode(true);
  pageIndicator.parentNode.replaceChild(newPageIndicator, pageIndicator);

  const updatedPageIndicator = document.getElementById('pageIndicator');
  updatedPageIndicator.addEventListener('dblclick', () => {
    handlePageIndicatorDoubleClick(totalPages, isAllPoolsMode);
  });
}

// 处理页码双击事件
function handlePageIndicatorDoubleClick(totalPages, isAllPoolsMode) {
  const pageIndicator = document.getElementById('pageIndicator');
  const originalText = pageIndicator.textContent;

  // 创建输入框
  const inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 8px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.value = currentHistoryPage;
  input.style.cssText = `
    width: 50px;
    padding: 6px 8px;
    font-size: 14px;
    font-family: 'Consolas', monospace;
    border: 1px solid var(--ef-grey);
    background: rgba(0,0,0,0.3);
    color: var(--ef-yellow);
    box-sizing: border-box;
    outline: none;
    transition: 0.3s;
    text-align: center;
  `;

  // 焦点时的样式
  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--ef-yellow)';
    input.style.boxShadow = '0 0 10px rgba(255, 250, 0, 0.1)';
  });

  input.addEventListener('blur', () => {
    input.style.borderColor = 'var(--ef-grey)';
    input.style.boxShadow = 'none';
  });

  const totalLabel = document.createElement('span');
  totalLabel.textContent = `/ ${totalPages}`;
  totalLabel.style.cssText = 'color: #666; font-size: 12px;';

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(totalLabel);

  // 替换页码显示为输入框
  pageIndicator.innerHTML = '';
  pageIndicator.appendChild(inputWrapper);
  input.focus();
  input.select();

  // 确认跳页
  const confirmJump = () => {
    const newPage = parseInt(input.value, 10);

    if (isNaN(newPage) || newPage < 1 || newPage > totalPages) {
      showAppSnackbar({
        message: `[WARNING] Invalid page number. Please enter a number between 1 and ${totalPages}`,
        type: "warning"
      });
      pageIndicator.textContent = originalText;
      return;
    }

    if (newPage !== currentHistoryPage) {
      currentHistoryPage = newPage;
      if (isAllPoolsMode) {
        renderAllPoolsHistoryPage();
      } else {
        renderHistoryPage();
      }
    } else {
      pageIndicator.textContent = originalText;
    }
  };

  // 统一处理键盘事件
  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'];
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmJump();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      pageIndicator.textContent = originalText;
    } else if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  });

  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
  });

  // 失焦时确认
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.getElementById('pageIndicator').contains(input)) {
        confirmJump();
      }
    }, 100);
  });
}

function renderRareItemChip({
                              label,
                              isUpItem,
                              isNewItem,
                              chipBorderColor,
                              chipTextColor,
                              chipBgColor
                            }) {
  let borderColor, textColor, bgColor;
  let hasGlowEffect = false;
  if (isUpItem) {
    borderColor = chipBorderColor;
    textColor = chipTextColor;
    bgColor = chipBgColor;
    if (isNewItem) {
      hasGlowEffect = true;
    }
  } else if (isNewItem) {
    borderColor = "#e8a035";
    textColor = "#e8a035";
    bgColor = "rgba(255, 235, 59, 0.15)";
  } else {
    borderColor = "#666666";
    textColor = "#888888";
    bgColor = "#66666619";
  }
  const styleStr = `display: inline-block; border: 1px solid ${borderColor}; color: ${textColor};
  background: ${bgColor}; padding: 4px 10px; margin: 4px; font-size: 12px; font-weight: bold; font-family: 'Consolas';`;
  const glowClass = hasGlowEffect ? 'class="glow-up-new"' : '';
  return `<span ${glowClass} style="${styleStr}">${label}</span>`;
}

function renderRareRecordsCard(options) {
  const {
    sixStarDetails,
    headerText,
    titleText,
    countLabel,
    countValue,
    labelText,
    getChipLabel,
    getUpCharName,
  } = options;

  const container = document.getElementById("rareCharsContainer");
  container.style.padding = "24px";
  const accentColor = "var(--ef-accent)";
  const textStrong = "var(--ef-text-strong)";
  const textMuted = "var(--ef-text-muted)";
  const emptyColor = "var(--ef-empty)";
  const chipBorderColor = "var(--ef-chip-border)";
  const chipTextColor = "var(--ef-chip-text)";
  const chipBgColor = "var(--ef-chip-bg)";

  const chipsHtml = sixStarDetails.map(item => {
    const upCharName = getUpCharName ? getUpCharName(item) : null;
    const isUpItem = upCharName && item.name === upCharName;
    return renderRareItemChip({
      label: getChipLabel(item),
      isUpItem,
      isNewItem: item.isNew,
      chipBorderColor, chipTextColor, chipBgColor
    });
  }).join("");

  const emptyHtml = `<span style="color:${emptyColor}; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;
  container.innerHTML = `
    <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${accentColor};"></div>
    <div style="margin-left: 8px;">
      <div style="font-size:10px; color:${textMuted}; font-family:'Consolas'; letter-spacing:1px; margin-bottom:4px;">${headerText}</div>
      <div style="font-size:18px; font-weight:bold; color:${accentColor}; margin-bottom:12px; font-family:'Consolas'; text-transform:uppercase;">${titleText}</div>
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #777; padding-bottom:12px; margin-bottom:12px;">
        <div style="font-size:16px; font-weight: bold; color:${textStrong};">${countLabel}</div>
        <div style="font-size:16px; font-weight: bold; color:${textStrong};">${countValue}</div>
      </div>
      <div>
        <div style="font-size:10px; color:${textMuted}; margin-bottom:8px; font-family:'Consolas';">// ${labelText}</div>
        <div style="display:flex; flex-wrap:wrap; margin-left:-4px;">
          ${sixStarDetails.length > 0 ? chipsHtml : emptyHtml}
        </div>
      </div>
    </div>
  `;
}

function createRareRecordCard(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const sixStarDetails = calculateSixStarDetails(items, true);
  const labelText = (currentType === 'char') ? "RECENT 6★ CHARACTERS" : "RECENT 6★ WEAPONS";

  renderRareRecordsCard({
    sixStarDetails,
    headerText: "TARGET POOL IDENTIFIED",
    titleText: poolName,
    countLabel: "TOTAL RECORDS:",
    countValue: items.length,
    labelText,
    getChipLabel: (item) => `${item.name} [${item.pityText}]`,
    getUpCharName: () => globalPoolConfig && globalPoolConfig[poolName] ? globalPoolConfig[poolName] : null,
  });
}

// 更新汇总卡池标签
function updateAllBtnText() {
  const btn = document.getElementById('btnTypeAll');
  if (!btn) return;
  // 你想显示的提示文字
  const hint = (lastDataType === 'char') ? "CHAR" : "WEAPON"; // 默认 CHAR
  btn.textContent = `[ ALL POOLS / 汇总分析 (${hint}) ]`;
}

// 合并所有卡池的数据并按卡池配置顺序排序
function mergeAllPoolsData(dataMap) {
  const merged = [];
  for (const poolName of globalPoolOrder) {
    if (dataMap[poolName]) {
      merged.push(...dataMap[poolName]);
    }
  }
  for (const poolName in dataMap) {
    if (!globalPoolOrder.includes(poolName)) {
      merged.push(...dataMap[poolName]);
    }
  }
  return merged.reverse();
}

// 汇总模式的主显示函数
function displayAllPoolsSummary(allItems) {
  updateOrCreateChart(allItems);
  createAllPoolsRareRecordsCard(allItems);
  createAllPoolsSummaryStrip(allItems);
  createAllPoolsHistoryTable(allItems);
}

function createAllPoolsSummaryStrip(items) {
  const { total, notFreeTotal, sixStarCount, rate } = calculatePoolStats(items);
  const typeLabel = (lastDataType === 'char') ? "CHARACTERS" : "WEAPONS";

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
  updateCurrencyDisplay(notFreeTotal, lastDataType);
}

function createAllPoolsRareRecordsCard(items) {
  const sixStarDetails = calculateSixStarDetails(items);
  const labelText = (currentType === 'char') ? "ALL 6★ CHARACTERS" : "ALL 6★ WEAPONS";

  renderRareRecordsCard({
    sixStarDetails,
    headerText: "ALL POOLS ANALYSIS",
    titleText: "历史汇总",
    countLabel: "TOTAL 6★ RECORDS:",
    countValue: sixStarDetails.length,
    labelText,
    getChipLabel: (item) => `${item.name} - ${item.poolName} [${item.pityText}]`,
    getUpCharName: (item) => globalPoolConfig && globalPoolConfig[item.poolName] ? globalPoolConfig[item.poolName] : null,
  });
}

function createAllPoolsHistoryTable(items) {
  currentHistoryPage = 1;
  currentHistoryData = items.slice();
  renderAllPoolsHistoryPage();
}

function renderAllPoolsHistoryPage() {
  renderPagedHistoryTable({
    items: currentHistoryData,
    isAllPoolsMode: true,
    getPoolLabel: (item) => item.poolName,
    emptyMessage: 'NO DATA AVAILABLE',
    emptyColspan: 5
  });
}

function updateOrCreateChart(items) {
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
  ctx.style.maxWidth = "280px";
  ctx.style.maxHeight = "280px";
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
        loadingOverlay.classList.remove("show");
        if(loadingTrack) {
          loadingTrack.style.transition = "none";
          loadingTrack.style.transform = "scaleX(1)";
          loadingTrack.style.opacity = "1";
        }
        if(logoWrapper) logoWrapper.style.transform = "";
        if(loadingText) loadingText.style.transform = "";
        const elements = APP_ELEMENT_IDS.map(id => document.getElementById(id));
        const flexIds = new Set(["mainTitle", "typeSwitcher", "dashboardPanel"]);
        elements.forEach((el) => {
          if (!el) return;
          const needFlex = flexIds.has(el.id) || (el.id === 'summaryStrip' && el.style.display !== 'none');
          el.style.display = needFlex ? 'flex' : 'block';
          el.classList.remove('pool-selector-hidden');
        });
        // 依次执行入场动画
        elements.forEach((el, index) => {
          if(el) { setTimeout(() => {
            el.style.transition = "all 0.5s ease-out";
            el.style.opacity = "1";
            el.style.visibility = "visible";
            el.style.transform = "translateY(0)";
            }, index * 100); }
        });
      }, 500);
    }, 400);
  }, 400);
}

window.resetToAnalyze = function() {
  // 重置全局数据
  cachedHgToken = ""
  currentUid = ""
  currentServerType = ""
  globalCharData = null
  globalWeaponData = null
  currentType = 'char'
  lastDataType = 'char'
  currentPool = null
  currentAllPoolsData = null
  isAllPoolsMode = false
  // UI 界面复位，从 APP 界面切回登录界面
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.classList.remove("show");
  loadingOverlay.style.transform = "";

  // 隐藏APP内部的DOM
  APP_ELEMENT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "none";
    if (id === "poolSelectorWrapper") {
      el.classList.add('pool-selector-hidden');
      el.style.visibility = 'hidden';
      el.style.height = '0';
      el.style.overflow = 'hidden';
    }
  });

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
