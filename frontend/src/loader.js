import {
  LoadGachaTokens, CheckLocalFiles, GetCharacterData, GetWeaponData,
  LoadLocalGachaHistory, DeleteLocalGachaHistory, ImportTemporaryJson,
} from "../wailsjs/go/main/App";

import {
  setCurrentUid, setCurrentServerType, setGlobalCharData,
  setGlobalWeaponData, setCurrentType, setIsOfflineSelection,
  getIsOfflineSelection,
} from './state.js';
import { SNACKBAR_AUTO_CLOSE } from './constants.js';
import { groupDataByPool } from './data.js';
import { renderByType, updateAllBtnText } from './render/main.js';
import { loadPoolConfig, updatePoolConfigHandler } from './pool.js';
import { showAppSnackbar, showLoadingState, setFetchingState, resetButton } from './utils.js';

// 通过回调注入 startExitAnimation，避免与 main.js 循环依赖
let exitAnimator = null;
export function setExitAnimator(fn) {
  exitAnimator = fn;
}

// 双服选择逻辑处理
export async function onSelectServer(serverName) {
  const actionText = getIsOfflineSelection() ? "LOADING ARCHIVE" : "TARGET LOCKED";
  showLoadingState(actionText, `ACCESSING ${serverName.toUpperCase()} DATABASE...`);
  try {
    if (getIsOfflineSelection()) {
      throw new Error("离线模式缺少 UID，请从本地存档列表中选择具体记录");
    } else {
      await initApp(false, serverName);
    }
    setCurrentServerType(serverName);
  } catch (err) {
    console.error(err);
    window.resetToAnalyze();
    document.getElementById("analyzeError").textContent = "INIT ERROR: " + err;
  } finally {
    setIsOfflineSelection(false);
  }
}

// 在线分析逻辑处理
export async function analyze() {
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

    if (hasOfficial && hasBilibili) {
      document.getElementById("defaultBtnGroup").style.display = "none";
      document.getElementById("serverSelectArea").style.display = "block";
      resetButton(btn, originalText);
      return;
    }

    let targetServer = "official";
    if (hasBilibili) targetServer = "bilibili";

    resetButton(btn, originalText);

    showLoadingState("SYSTEM SYNCHRONIZING...", `TARGET CONFIRMED: ${targetServer.toUpperCase()}`);
    await initApp(false, targetServer, "");
    setCurrentServerType(targetServer);

  } catch (err) {
    console.error(err);
    resetButton(btn, originalText);
    document.getElementById("analyzeError").textContent = "ERR: " + err;
  }
}

// 离线分析文件
export async function loadLocal() {
  const btn = document.getElementById("localBtn");
  const originalText = btn.textContent;
  btn.textContent = "SCANNING FILES...";
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";
  try {
    const archives = await CheckLocalFiles();
    if (!archives || archives.length === 0) {
      throw "NO LOCAL ARCHIVES FOUND // 未找到本地历史记录";
    }
    if (archives.length === 1 && archives[0].servers.length === 1) {
      const targetArchive = archives[0];
      const targetServer = targetArchive.servers[0];
      const targetUid = targetArchive.uid;
      resetButton(btn, originalText);
      setIsOfflineSelection(true);
      showLoadingState("LOADING LOCAL ARCHIVE...", `UID: ${targetUid} // ${targetServer.toUpperCase()}`);
      await initApp(true, targetServer, targetUid);
      return;
    }
    renderLocalArchiveList(archives);
    document.getElementById("defaultBtnGroup").style.display = "none";
    document.getElementById("playerSelectArea").style.display = "block";
    const desc = document.querySelector("#playerSelectArea .analyze-important-desc");
    if (desc) desc.innerHTML = "> LOCAL ARCHIVES FOUND // 发现本地存档<br>> SELECT DATA SOURCE // 请选择要加载的记录";
    resetButton(btn, originalText);
  } catch (err) {
    console.error(err);
    resetButton(btn, originalText);
    document.getElementById("analyzeError").textContent = "ERR: " + err;
  }
}

// 渲染本地存档列表
export function renderLocalArchiveList(archives) {
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

      div.onclick = () => doLocalLoad(arc.uid, server);

      const deleteBtn = div.querySelector('.del-archive-btn');
      deleteBtn.onclick = (e) => {
        e.stopPropagation();

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
export async function doLocalLoad(uid, serverName) {
  document.getElementById("playerSelectArea").style.display = "none";
  setIsOfflineSelection(true);
  setCurrentServerType(serverName);
  showLoadingState("LOADING LOCAL DATABASE...", `TARGET: UID ${uid} // ${serverName.toUpperCase()}`);
  try {
    await initApp(true, serverName, uid);
  } catch (err) {
    console.error(err);
    window.resetToAnalyze();
    document.getElementById("analyzeError").textContent = "LOAD ERR: " + err;
  }
}

// 临时导入浏览 (不落盘)
export async function handleImportTemp() {
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
      setGlobalCharData(groupedData);
      setGlobalWeaponData({});
      setCurrentType('char');
    } else {
      setGlobalWeaponData(groupedData);
      setGlobalCharData({});
      setCurrentType('weapon');
    }
    const exportBtn = document.getElementById("btnExportExcel");
    if (exportBtn) exportBtn.style.display = "none";
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
      if (exitAnimator) exitAnimator();
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
    window.resetToAnalyze();
  }
}

export async function initApp(isOfflineMode, serverName = "official", uid = "") {
  if (isOfflineMode) {
    setCurrentUid(uid);
  } else {
    setCurrentUid("");
  }

  const loadingText = document.querySelector('.loading-text');

  let charDataGrouped, weaponDataGrouped;
  if (isOfflineMode) {
    loadingText.textContent = 'READING LOCAL FILES...';
    const dataStruct = await LoadLocalGachaHistory(uid, serverName);
    charDataGrouped = dataStruct.char || {};
    weaponDataGrouped = dataStruct.weapon || {};
  } else {
    loadingText.textContent = 'FETCHING DATA ...';
    setFetchingState(true);

    const [charResult, weaponResult] = await Promise.all([
      GetCharacterData(serverName).catch(e => { console.warn("Character data fetch failed:", e); return null; }),
      GetWeaponData(serverName).catch(e => { console.warn("Weapon data fetch failed:", e); return null; }),
    ]);
    const charRes = charResult;
    const weaponRes = weaponResult;
    const charList = charRes?.list || [];
    const weaponList = weaponRes?.list || [];
    const charFetchError = charResult === null ? true : null;
    const weaponFetchError = weaponResult === null ? true : null;

    setFetchingState(false);

    if (charFetchError && weaponFetchError) {
      showAppSnackbar({
        message: `[ERROR] 角色池与武器池数据均加载失败: ${charFetchError} / ${weaponFetchError}。`,
        type: "error",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
      window.resetToAnalyze();
      return;
    }
    setCurrentUid(charRes?.uid || weaponRes?.uid || "");
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

  try {
    await updatePoolConfigHandler();
  } catch (err) {
    console.warn("Auto-update pool config failed:", err);
  }

  await loadPoolConfig();

  setGlobalCharData(charDataGrouped);
  setGlobalWeaponData(weaponDataGrouped);
  loadingText.textContent = 'DATA STREAM RECEIVED';

  renderByType('char');
  updateAllBtnText();
  if (exitAnimator) exitAnimator();
}
