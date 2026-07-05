import { GetPoolConfig, UpdatePoolConfig } from "../wailsjs/go/main/App";

import {FALLBACK_POOL_CONFIG, FALLBACK_POOL_ORDER, SNACKBAR_AUTO_CLOSE,} from './constants.js';
import {
  getGlobalPoolConfig, setGlobalPoolConfig, getGlobalPoolOrder,
  setGlobalPoolOrder, getCurrentPool, setCurrentPool,
} from './state.js';
import { showAppSnackbar } from './utils.js';

// 加载卡池配置
export async function loadPoolConfig() {
  if (getGlobalPoolConfig()) return getGlobalPoolConfig();
  try {
    const config = await GetPoolConfig();
    if (config && config.pools && config.pools.length > 0) {
      const poolConfig = {};
      const poolOrder = [];
      config.pools.forEach(pool => {
        poolConfig[pool.poolName] = pool.up6Name;
        poolOrder.push(pool.poolName);
      });
      setGlobalPoolConfig(poolConfig);
      setGlobalPoolOrder(poolOrder);
    }
  } catch (err) {
    console.warn("Failed to load pool config, using fallback:", err);
    setGlobalPoolConfig({ ...FALLBACK_POOL_CONFIG });
    setGlobalPoolOrder([...FALLBACK_POOL_ORDER]);
  }
  return getGlobalPoolConfig();
}

// 更新卡池配置
export async function updatePoolConfigHandler() {
  try {
    let msg = await UpdatePoolConfig();
    setGlobalPoolConfig(null);
    await loadPoolConfig();
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

export function createPoolButtons(dataMap, onPoolChange) {
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

  const dropdown = document.createElement('div');
  dropdown.className = 'pool-dropdown-wrapper';

  // 按 globalPoolOrder 顺序过滤 dataMap 中存在的卡池
  const poolOrder = getGlobalPoolOrder();
  const pools = poolOrder.filter(poolName => poolName in dataMap);
  Object.keys(dataMap).forEach(poolName => {
    if (!pools.includes(poolName)) {
      pools.push(poolName);
    }
  });
  setCurrentPool(pools[pools.length - 1]);

  const display = document.createElement('div');
  display.className = 'pool-display';
  display.textContent = getCurrentPool();
  display.addEventListener('click', () => {
    menu.classList.toggle('show');
  });
  dropdown.appendChild(display);

  const menu = document.createElement('div');
  menu.className = 'pool-menu';

  pools.reverse().forEach((poolName) => {
    const item = document.createElement('div');
    item.className = 'pool-menu-item';
    item.textContent = poolName;
    if (poolName === getCurrentPool()) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => {
      display.textContent = poolName;
      setCurrentPool(poolName);
      document.querySelectorAll('.pool-menu-item').forEach(i => {
        i.classList.remove('active');
      });
      item.classList.add('active');
      menu.classList.remove('show');
      onPoolChange(dataMap, poolName);
    });
    menu.appendChild(item);
  });

  dropdown.appendChild(menu);
  container.appendChild(dropdown);
  poolSelectorWrapper.appendChild(container);

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      menu.classList.remove('show');
    }
  });
}
