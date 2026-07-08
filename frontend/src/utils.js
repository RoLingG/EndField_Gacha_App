import { getGachaChartInstance, setGachaChartInstance, setIsFetching } from './state.js';
import { SNACKBAR_AUTO_CLOSE, JADE_PER_PULL, JADE_PER_STONE, WEAPON_QUOTA_PER_TEN } from './constants.js';

// mdui Snackbar封装
export function showAppSnackbar({
  message = "",
  type = "info",
  autoCloseDelay = SNACKBAR_AUTO_CLOSE,
  closeable = false,
} = {}) {
  const snackbar = document.createElement("mdui-snackbar");
  snackbar.className = `app-snackbar app-snackbar--${type}`;
  snackbar.textContent = message;
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

export function setFetchingState(fetching) {
  setIsFetching(fetching);
  const btn = document.getElementById("btnCancelFetch");
  if (btn) btn.style.display = fetching ? "inline-block" : "none";
}

export function resetButton(btn, text) {
  btn.textContent = text;
  btn.disabled = false;
}

export function setPoolSelectorVisibility(el, visible) {
  if (visible) {
    const h = el.scrollHeight;
    el.style.transition = "height .25s ease-out, opacity .20s ease-out, margin-bottom .25s ease-in";
    el.style.height = "0px";
    el.style.marginBottom = "20px"
    requestAnimationFrame(() => {
      el.style.height = h + "px";
      el.style.opacity = "1";
    });
    el.addEventListener("transitionend", function handler(e) {
      if (e.propertyName !== "height") return;
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      el.removeEventListener("transitionend", handler);
    });
  } else {
    // 先禁用 pool-menu 的 max-height transition，避免和 wrapper 的 collapse 冲突
    const menu = el.querySelector('.pool-menu');
    if (menu) {
      menu.style.transition = 'none';
      menu.classList.remove('show');
    }
    el.style.transition = "height .25s ease-in, opacity .20s ease-out, margin-bottom .25s ease-in";
    el.style.height = el.scrollHeight + "px";
    requestAnimationFrame(() => {
      el.style.height = "0px";
      el.style.opacity = "0";
      el.style.marginBottom = "0"
    });
  }
}

export function showLoadingState(mainText, subText) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  document.querySelector('.loading-text').textContent = mainText;
  document.querySelector('.loading-subtext').textContent = subText;
  const analyzeContainer = document.getElementById("analyzeContainer");
  analyzeContainer.style.opacity = "0";
  analyzeContainer.style.display = "none";
  requestAnimationFrame(() => {
    loadingOverlay.classList.add("show");
  });
}

export function updateSummaryStripVisibility(visible) {
  const summaryStrip = document.getElementById('summaryStrip');
  if (!summaryStrip) return;
  summaryStrip.style.display = visible ? 'flex' : 'none';
}

export function clearDisplay() {
  const chartInstance = getGachaChartInstance();
  if (chartInstance) {
    chartInstance.destroy();
    setGachaChartInstance(null);
  }
  document.getElementById("chartContainer").innerHTML = "";
  document.getElementById("rareCharsContainer").innerHTML = "";
  document.getElementById("summaryStrip").innerHTML = "";
  document.getElementById("historyTableBody").innerHTML = "";
  const currencyInfo = document.getElementById('currencyInfo');
  if (currencyInfo) {
    currencyInfo.style.display = 'none';
    document.getElementById('jadeValue').textContent = '0';
    document.getElementById('stoneValue').textContent = '0';
  }
}

export function updateCurrencyDisplay(notFreeTotal, type) {
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
