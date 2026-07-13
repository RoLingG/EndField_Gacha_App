import {
  WindowClose, WindowMinSize, WindowToggleMaxSize,
  OpenDataFolder, ReloadFrontend, ExportData, CancelCurrentOperation,
} from "../wailsjs/go/main/App";

import {
  setCachedHgToken, setCurrentUid, setCurrentServerType, setGlobalCharData,
  setGlobalWeaponData, setCurrentType, setLastDataType, setCurrentPool, setCurrentAllPoolsData,
  setIsAllPoolsMode, getIsFetching, getCurrentServerType, getCurrentUid, setIsFetching,
} from './state.js';

import { APP_ELEMENT_IDS, SNACKBAR_AUTO_CLOSE } from './constants.js';
import { switchType } from './render/main.js';
import { changePage } from './render/history.js';
import { updateOrCreateChart } from './render/chart.js';
import { setChartUpdater, initThemeToggle } from './theme.js';
import { showAppSnackbar, setFetchingState } from './utils.js';
import { showTokenInputUI, handleOfficialLoginWindow, handleToken, setDataLoader,} from './auth.js';
import { onSelectServer, loadLocal, handleImportTemp, initApp, setExitAnimator,} from './loader.js';

// ============================================
// 注入回调，打破循环依赖
// ============================================
setChartUpdater(updateOrCreateChart);
setExitAnimator(startExitAnimation);
setDataLoader(initApp);

// ============================================
// Chart.js 全局配置
// ============================================
Chart.defaults.color = '#ffffff';
Chart.defaults.borderColor = '#333333';
Chart.defaults.font.family = "'Consolas', 'Monaco', monospace";

// ============================================
// 窗口控件
// ============================================
const maxBtn = document.getElementById("maxBtn");
if (maxBtn) {
  maxBtn.onclick = async () => {
    const isMax = await WindowToggleMaxSize();
    maxBtn.textContent = isMax ? "❐" : "□";
  };
}
document.getElementById("minBtn").onclick = () => WindowMinSize();
document.getElementById("closeBtn").onclick = () => WindowClose();

// ============================================
// 窗口操作函数
// ============================================

async function handleReload() {
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
  setIsFetching(false)
  await ReloadFrontend();
}

async function handleCancelFetch() {
  if (!getIsFetching()) return;

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

  dialog.querySelector('.dialog-cancel-btn').onclick = () => {
    dialog.open = false;
  };

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

  dialog.addEventListener('closed', () => {
    setTimeout(() => dialog.remove(), 300);
  });
}

async function handleExport() {
  if (!getCurrentServerType()) {
    showAppSnackbar({
      message: "[WARNING] 请先加载数据 (Please Initialize Data First)",
      type: "warning"
    });
    return;
  }
  try {
    const result = await ExportData(getCurrentUid(), getCurrentServerType());
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

// ============================================
// 动画 & 导航
// ============================================

function startExitAnimation() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const loadingTrack = document.querySelector('.tech-progress-track');
  const logoWrapper = document.querySelector('.logo-wrapper');
  const techStatRow = document.querySelector('.tech-stat-row');

  if (loadingTrack) {
    loadingTrack.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease";
    loadingTrack.style.transform = "scaleX(0)";
    loadingTrack.style.opacity = "0";
  }

  setTimeout(() => {
    if (loadingText) {
      loadingText.style.transition = "all 0.5s ease-in";
      loadingText.style.opacity = "0";
      loadingText.style.transform = "translateY(-20px)";
    }
    if (logoWrapper) {
      logoWrapper.style.transition = "all 0.5s ease-in";
      logoWrapper.style.opacity = "0";
      logoWrapper.style.transform = "scale(0.5)";
    }
    setTimeout(() => {
      loadingOverlay.style.transition = "transform 0.6s cubic-bezier(0.8, 0, 0.2, 1)";
      loadingOverlay.style.transform = "translateY(-100%)";
      if (techStatRow) {
        techStatRow.style.transition = "opacity 0.2s ease-in";
        techStatRow.style.opacity = "0";
      }

      setTimeout(() => {
        loadingOverlay.classList.remove("show");
        if (loadingTrack) {
          loadingTrack.style.transition = "none";
          loadingTrack.style.transform = "scaleX(1)";
          loadingTrack.style.opacity = "1";
        }
        if (logoWrapper) logoWrapper.style.transform = "";
        if (loadingText) loadingText.style.transform = "";
        if (techStatRow) {
          techStatRow.style.transition = "";
          techStatRow.style.opacity = "";
          techStatRow.style.transform = "";
        }
        const elements = APP_ELEMENT_IDS.map(id => document.getElementById(id));
        const flexIds = new Set(["mainTitle", "typeSwitcher", "dashboardPanel"]);
        elements.forEach((el) => {
          if (!el) return;
          const needFlex = flexIds.has(el.id) || (el.id === 'summaryStrip' && el.style.display !== 'none');
          el.style.display = needFlex ? 'flex' : 'block';
        });
        elements.forEach((el, index) => {
          if (el) {
            setTimeout(() => {
              el.style.transition = "all 0.5s ease-out";
              el.style.opacity = "1";
              el.style.visibility = "visible";
              el.style.transform = "translateY(0)";
            }, index * 100);
          }
        });
      }, 500);
    }, 400);
  }, 400);
}

window.resetToAnalyze = function () {
  setCachedHgToken("");
  setCurrentUid("");
  setCurrentServerType("");
  setGlobalCharData(null);
  setGlobalWeaponData(null);
  setCurrentType('char');
  setLastDataType('char');
  setCurrentPool(null);
  setCurrentAllPoolsData(null);
  setIsAllPoolsMode(false);

  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.classList.remove("show");
  loadingOverlay.style.transform = "";

  APP_ELEMENT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "none";
  });

  const analyzeContainer = document.getElementById("analyzeContainer");
  analyzeContainer.style.display = "flex";
  void analyzeContainer.offsetWidth;
  analyzeContainer.style.opacity = "1";

  document.getElementById("serverSelectArea").style.display = "none";
  document.getElementById("tokenInputArea").style.display = "none";
  document.getElementById("playerSelectArea").style.display = "none";

  const adTips = document.getElementById("analyzeDescription");
  if (adTips) adTips.style.display = "block";

  const input = document.getElementById("webTokenInput");
  if (input) {
    input.value = "";
    input.disabled = false;
  }
  const officialBtn = document.getElementById("btnLoginWindow");
  if (officialBtn) {
    officialBtn.textContent = "CONNECT (OFFICIAL)";
    officialBtn.disabled = false;
  }

  const defaultBtnGroup = document.getElementById("defaultBtnGroup");
  if (defaultBtnGroup) defaultBtnGroup.style.display = "block";

  const btn = document.getElementById("analyzeBtn");
  if (btn) {
    btn.textContent = "ONLINE INITIALIZE (LOG)";
    btn.disabled = false;
  }

  const localBtn = document.getElementById("localBtn");
  if (localBtn) {
    localBtn.textContent = "LOCAL INITIALIZE";
    localBtn.disabled = false;
  }

  const errDiv = document.getElementById("analyzeError");
  if (errDiv) errDiv.textContent = "";
};

// ============================================
// INIT & EVENTS
// ============================================

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const container = document.getElementById('analyzeContainer');
    if (container) container.classList.add('show');
  }, 100);

  initThemeToggle();

  window.runtime.EventsOff('fetch-progress');
  window.runtime.EventsOn('fetch-progress', (message) => {
    const subtextElement = document.querySelector('.loading-subtext');
    if (subtextElement) {
      subtextElement.textContent = message;
    }
  });

  // ============================================
  // 事件绑定
  // ============================================

  // 顶部菜单栏
  document.getElementById('btnReload')?.addEventListener('click', handleReload);
  document.getElementById('btnOpenFolder')?.addEventListener('click', () => OpenDataFolder());
  document.getElementById('btnExportExcel')?.addEventListener('click', handleExport);
  document.getElementById('btnCancelFetch')?.addEventListener('click', handleCancelFetch);

  // 登录区
  document.getElementById('btnLoginWindow')?.addEventListener('click', handleOfficialLoginWindow);
  document.getElementById('tokenForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleToken();
  });
  document.getElementById('webTokenBtn')?.addEventListener('click', showTokenInputUI);
  document.getElementById('localBtn')?.addEventListener('click', loadLocal);
  document.getElementById('importBtn')?.addEventListener('click', handleImportTemp);

  // 服务器选择
  document.getElementById('btnOfficial')?.addEventListener('click', () => onSelectServer('official'));
  document.getElementById('btnBilibili')?.addEventListener('click', () => onSelectServer('bilibili'));

  // 取消按钮（resetToAnalyze）
  document.getElementById('cancelTokenInput')?.addEventListener('click', resetToAnalyze);
  document.getElementById('cancelPlayerSelect')?.addEventListener('click', resetToAnalyze);
  document.getElementById('cancelServerSelect')?.addEventListener('click', resetToAnalyze);

  // 类型切换
  document.getElementById('btnTypeChar')?.addEventListener('click', () => switchType('char'));
  document.getElementById('btnTypeWeapon')?.addEventListener('click', () => switchType('weapon'));
  document.getElementById('btnTypeAll')?.addEventListener('click', () => switchType('all'));

  // 翻页
  document.getElementById('prevPageBtn')?.addEventListener('click', () => changePage(-1));
  document.getElementById('nextPageBtn')?.addEventListener('click', () => changePage(1));
});
