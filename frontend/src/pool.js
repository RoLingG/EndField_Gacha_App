import { GetPoolConfig, UpdatePoolConfig } from "../wailsjs/go/main/App";
import {
  FALLBACK_CHAR_POOL_CONFIG,
  FALLBACK_WEAPON_POOL_CONFIG,
  FALLBACK_POOL_ORDER,
  SNACKBAR_AUTO_CLOSE,
} from './constants.js';
import {
  getGlobalPoolConfig, setGlobalPoolConfig,
  getGlobalCharPoolOrder, setGlobalCharPoolOrder,
  getGlobalWeaponPoolOrder, setGlobalWeaponPoolOrder,
  getCurrentPool, setCurrentPool,
} from './state.js';
import { showAppSnackbar } from './utils.js';
import { t } from './i18n.js';

// 追踪当前的 click-outside handler，避免重复绑定
let currentOutsideClickHandler = null;

// 加载卡池配置
export async function loadPoolConfig() {
  if (getGlobalPoolConfig()) return getGlobalPoolConfig();
  try {
    const config = await GetPoolConfig();
    if (config && (config.charPools?.length > 0 || config.weaponPools?.length > 0)) {
      const poolConfig = {};
      const charPoolOrder = [];
      const weaponPoolOrder = [];
      // 加载角色池配置
      if (config.charPools) {
        config.charPools.forEach(pool => {
          poolConfig[pool.poolName] = pool.up6Name;
          charPoolOrder.push(pool.poolName);
        });
      }
      // 加载武器池配置
      if (config.weaponPools) {
        config.weaponPools.forEach(pool => {
          poolConfig[pool.poolName] = pool.up6Name;
          weaponPoolOrder.push(pool.poolName);
        });
      }
      setGlobalPoolConfig(poolConfig);
      setGlobalCharPoolOrder(charPoolOrder);
      setGlobalWeaponPoolOrder(weaponPoolOrder);
    }
  } catch (err) {
    console.warn("Failed to load pool config, using fallback:", err);
    setGlobalPoolConfig({ ...FALLBACK_CHAR_POOL_CONFIG });
    setGlobalCharPoolOrder([...FALLBACK_POOL_ORDER]);
    setGlobalWeaponPoolOrder([]);
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
      message: t('snackbar.updateFailed') + err,
      type: "error",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    });
  }
}

export function createPoolButtons(dataMap, onPoolChange, type = 'char') {
  if (!dataMap || typeof dataMap !== 'object' || Object.keys(dataMap).length === 0) {
    showAppSnackbar({
      message: t('snackbar.emptyPools'),
      type: "warning",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    })
    if (type === "weapon") {
      dataMap = { ...FALLBACK_WEAPON_POOL_CONFIG }
    } else {
      dataMap = { ...FALLBACK_CHAR_POOL_CONFIG }
    }
  }
  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (!poolSelectorWrapper) {
    console.warn('poolSelectorWrapper element not found');
    return;
  }
  poolSelectorWrapper.innerHTML = '';

  // 移除上一次绑定的 click-outside handler，避免泄漏
  if (currentOutsideClickHandler) {
    document.removeEventListener('click', currentOutsideClickHandler);
    currentOutsideClickHandler = null;
  }

  const container = document.createElement('div');
  container.className = 'pool-select-container';

  const label = document.createElement('label');
  label.className = 'pool-select-label';
  label.textContent = t('pool.select');
  container.appendChild(label);

  const dropdown = document.createElement('div');
  dropdown.className = 'pool-dropdown-wrapper';

  // 按对应类型的 poolOrder 顺序过滤 dataMap 中存在的卡池
  const poolOrder = (type === 'weapon') ? getGlobalWeaponPoolOrder() : getGlobalCharPoolOrder();
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

  // 全局 currentOutsideClickHandler 绑定 click handler，方便处理重复绑定问题
  currentOutsideClickHandler = (e) => {
    if (!dropdown.contains(e.target)) {
      menu.classList.remove('show');
    }
  };
  document.addEventListener('click', currentOutsideClickHandler);
}
