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

export function applyTheme(theme) {
  const body = document.body;
  const btn = document.getElementById("themeToggle");
  if (!body || !btn) return;
  const rootStyle = document.documentElement.style;
  let chartTextColor, chartBorderColor;

  if (theme === "day") {
    setGlobalTheme("day");
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
    setGlobalTheme("night");
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
