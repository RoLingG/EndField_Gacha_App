import {
  setGlobalTheme, getThemeStorageKey, getGachaChartInstance, setGachaChartInstance,
  getIsAllPoolsMode, getCurrentAllPoolsData, getCurrentPool,
  getLastDataType, getGlobalCharData, getGlobalWeaponData,
} from './state.js';

// 通过回调注入图表更新函数，避免与 render/chart.js 循环依赖
let chartUpdater = null;
export function setChartUpdater(fn) {
  chartUpdater = fn;
}

// stats 图表重建回调
let statsChartUpdater = null;
export function setStatsChartUpdater(fn) {
  statsChartUpdater = fn;
}

// 主题色
const themes = {
  day: {
    vars: {
      "--ef-accent": "#d9b500",
      "--ef-text-strong": "#1f1f1f",
      "--ef-text-muted": "#777",
      "--ef-divider": "#cfcfc7",
      "--ef-empty": "#777",
      "--ef-chip-border": "#d45a2a",
      "--ef-chip-text": "#d45a2a",
      "--ef-chip-bg": "rgba(212, 90, 42, 0.12)"
    },
    chartTextColor: "#1f1f1f",
  },
  night: {
    vars: {
      "--ef-accent": "#fffa00",
      "--ef-text-strong": "#cccccc",
      "--ef-text-muted": "#666",
      "--ef-divider": "#333",
      "--ef-empty": "#444",
      "--ef-chip-border": "#ff5722",
      "--ef-chip-text": "#ff5722",
      "--ef-chip-bg": "rgba(255, 87, 34, 0.1)"
    },
    chartTextColor: "#ffffff",
  }
};

export function applyTheme(theme) {
  const body = document.body;
  const btn = document.getElementById("themeToggle");
  if (!body || !btn) return;
  const rootStyle = document.documentElement.style;
  const themeConfig = themes[theme] || themes.night;

  if (theme === "day") {
    setGlobalTheme("day");
    body.classList.add("theme-day");
    btn.textContent = "[ MODE: DAY ]";
  } else {
    setGlobalTheme("night");
    body.classList.remove("theme-day");
    btn.textContent = "[ MODE: NIGHT ]";
  }

  // 修改主题色
  for (const [key, value] of Object.entries(themeConfig.vars)) {
    rootStyle.setProperty(key, value);
  }
  Chart.defaults.color = themeConfig.chartTextColor;

  const chartInstance = getGachaChartInstance();
  if (chartInstance) {
    chartInstance.destroy();
    setGachaChartInstance(null);
  }

  // 重建图表（通过回调调用，避免循环依赖）
  if (chartUpdater) {
    if (getIsAllPoolsMode() && getCurrentAllPoolsData()) {
      chartUpdater(getCurrentAllPoolsData());
    } else if (getCurrentPool()) {
      const dataMap = (getLastDataType() === 'char') ? getGlobalCharData() : getGlobalWeaponData();
      if (dataMap && dataMap[getCurrentPool()]) {
        chartUpdater(dataMap[getCurrentPool()]);
      }
    }
  }

  // 重建 stats 图表（如果当前在 stats 标签页）
  if (statsChartUpdater) {
    statsChartUpdater();
  }
}

export function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const saved = localStorage.getItem(getThemeStorageKey()) || "night";
  applyTheme(saved);

  btn.addEventListener("click", () => {
    const next = document.body.classList.contains("theme-day") ? "night" : "day";
    localStorage.setItem(getThemeStorageKey(), next);
    applyTheme(next);
    if (typeof window.onThemeChanged === "function") {
      window.onThemeChanged(next);
    }
  });
}
