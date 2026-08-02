import {
  getCurrentHistoryPage, setCurrentHistoryPage, getHistoryPageSize,
  getCurrentHistoryData, setCurrentHistoryData, getIsAllPoolsMode,
  setCurrentPoolNameForPagination, getCurrentPoolNameForPagination,
  getFilterSearchText, setFilterSearchText,
  getFilterRarity, setFilterRarity,
  getFilterIsFree, setFilterIsFree,
} from '../state.js';
import { getItemName } from '../data.js';
import { showAppSnackbar } from '../utils.js';
import { t } from '../i18n.js';

const originalNumMap = new WeakMap();
const FILTER_CACHE_DEFAULT = { searchText: '', rarity: 0, isFree: -1, items: null, result: [] };
let filterCache = { ...FILTER_CACHE_DEFAULT };

// 统一渲染历史记录空状态
export function renderEmptyHistoryTable(message, colspan = 5) {
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
export function updateHistoryPaginationUI(currentPage, totalPages) {
  const pageInfo = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (pageInfo) pageInfo.textContent = `${t('pagination.page')} ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages || totalPages === 0);
}

// 根据筛选状态过滤数据
function applyFilters(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const searchText = getFilterSearchText().toLowerCase();
  const rarity = getFilterRarity();
  const isFree = getFilterIsFree();

  if (filterCache.searchText === searchText && filterCache.rarity === rarity
      && filterCache.isFree === isFree && filterCache.items === items) {
    return filterCache.result
  }

  const result = items.filter(item => {
    if (searchText) {
      const name = getItemName(item).toLowerCase();
      if (!name.includes(searchText)) return false;
    }
    if (rarity > 0 && item.rarity !== rarity) return false;
    if (isFree === 0 && item.isFree) return false;
    if (isFree === 1 && !item.isFree) return false;
    return true;
  });

  filterCache = {searchText, rarity, isFree, items, result}
  return result
}

// 筛选栏事件绑定（只初始化一次）
let filterBarInitialized = false;
export function initFilterBar() {
  if (filterBarInitialized) return;
  filterBarInitialized = true;

  const searchInput = document.getElementById('filterSearchInput');
  const raritySelect = document.getElementById('filterRaritySelect');
  const isFreeSelect = document.getElementById('filterIsFreeSelect');

  // 搜索输入防抖
  let debounceTimer = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setFilterSearchText(searchInput.value.trim());
      setCurrentHistoryPage(1);
      reRenderCurrentPage();
    }, 300);
  });

  raritySelect?.addEventListener('change', (e) => {
    setFilterRarity(parseInt(e.target.value, 10));
    setCurrentHistoryPage(1);
    reRenderCurrentPage();
  });

  isFreeSelect?.addEventListener('change', (e) => {
    setFilterIsFree(parseInt(e.target.value, 10));
    setCurrentHistoryPage(1);
    reRenderCurrentPage();
  });
}

// 重置筛选状态和 UI
export function resetFilters() {
  setFilterSearchText("");
  setFilterRarity(0);
  setFilterIsFree(-1);
  filterCache = { ...FILTER_CACHE_DEFAULT };

  const searchInput = document.getElementById('filterSearchInput');
  const raritySelect = document.getElementById('filterRaritySelect');
  const isFreeSelect = document.getElementById('filterIsFreeSelect');
  if (searchInput) searchInput.value = "";
  if (raritySelect) raritySelect.value = "0";
  if (isFreeSelect) isFreeSelect.value = "-1";
}

// 根据当前模式重新渲染
function reRenderCurrentPage() {
  if (getIsAllPoolsMode()) {
    renderAllPoolsHistoryPage();
  } else {
    renderHistoryPage();
  }
}

// 渲染行到 tbody（内部辅助函数）
function renderTableRows(tbody, pageItems, totalItems, startIndex, getPoolLabel, emptyMessage, emptyColspan) {
  tbody.innerHTML = '';
  if (pageItems.length === 0) {
    renderEmptyHistoryTable(emptyMessage, emptyColspan);
  } else {
    pageItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      const displayNum = originalNumMap.get(item) || (totalItems - (startIndex + index));
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
}

// 防止快速点击导致动画链条断裂
let isAnimating = false;

function cleanupAnimation(tbody) {
  isAnimating = false;
  tbody.classList.remove(
      'history-slide-out-left', 'history-slide-out-right',
      'history-slide-in-left', 'history-slide-in-right'
  );
  tbody.onanimationend = null;
  tbody.ontransitionend = null;
  tbody.style.removeProperty('height');
}

// 换页动画 debounce，快速连点只执行最后一次
let changePageDebounceTimer = null;

function clearChangePageDebounce() {
  if (changePageDebounceTimer) {
    clearTimeout(changePageDebounceTimer);
    changePageDebounceTimer = null;
  }
}

// 统一渲染卡池历史记录分页
// direction: "left" | "right" | null — 控制换页滑动方向
export function renderPagedHistoryTable({
  items,
  isAllPoolsMode,
  getPoolLabel = () => 'UNKNOWN',
  emptyMessage = 'NO DATA AVAILABLE',
  emptyColspan = 5,
  direction = null
}) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  // 应用筛选
  const filteredItems = applyFilters(items);
  const totalItems = filteredItems.length;
  const pageSize = getHistoryPageSize();
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  let page = getCurrentHistoryPage();
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  setCurrentHistoryPage(page);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = filteredItems.slice(startIndex, endIndex);

  // 首次加载、筛选、跳页直接渲染
  if (!direction) {
    clearChangePageDebounce();
    renderTableRows(tbody, pageItems, totalItems, startIndex, getPoolLabel, emptyMessage, emptyColspan);
    updateHistoryPaginationUI(page, totalPages);
    initPageIndicatorEditing(totalPages, isAllPoolsMode);
    return;
  }

  if (isAnimating) {
    // 清理动画上一次切页的 Debounce
    clearChangePageDebounce();
    // 创建新 Debounce，设置延迟动画定时器，防止切页过快动画和渲染不匹配
    // 这样做的好处是动画时间内无论点击了多少次，最后都是两次动画
    // 但因为动画与点击较快，用户模糊视觉上认为是高速切页看不清动画而不是动画次数少了
    changePageDebounceTimer = setTimeout(() => {
      changePageDebounceTimer = null;
      cleanupAnimation(tbody);
      renderPagedHistoryTable({ items, isAllPoolsMode, getPoolLabel, emptyMessage, emptyColspan, direction });
    }, 150);
    updateHistoryPaginationUI(page, totalPages);
    return;
  }

  isAnimating = true;
  // 旧记录滑出 → 渲染新行 → 新记录滑入
  const outClass = direction === 'left' ? 'history-slide-out-left' : 'history-slide-out-right';
  const inClass = direction === 'left' ? 'history-slide-in-right' : 'history-slide-in-left';

  // 旧记录滑出
  tbody.classList.add(outClass);
  // 动画结束后替换内容并滑入
  tbody.onanimationend = () => {
    tbody.classList.remove(outClass);
    // 记录旧高度（slide out 结束后的内容高度）
    const oldHeight = tbody.offsetHeight;
    renderTableRows(tbody, pageItems, totalItems, startIndex, getPoolLabel, emptyMessage, emptyColspan);
    const newHeight = tbody.offsetHeight;
    // 高度变化时，JS 高度动画与 slide in 同时播放
    if (oldHeight !== newHeight) {
      tbody.style.height = oldHeight + 'px';
      tbody.classList.add(inClass);
      const startTime = performance.now();
      const duration = 100;
      // 历史记录高度动画渲染，每渲染一帧调用一次
      const animateHeight = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);  // 计算缓动曲线（先快后慢）
        tbody.style.height = (oldHeight + (newHeight - oldHeight) * eased) + 'px';  // 根据缓动曲线计算当前高度
        if (progress < 1) {
          requestAnimationFrame(animateHeight);
        } else {
          tbody.style.removeProperty('height');
          cleanupAnimation(tbody);
        }
      };
      requestAnimationFrame(animateHeight);
    } else {
      // 高度没变，走原有纯 slide 逻辑
      tbody.classList.add(inClass);
      tbody.onanimationend = () => {
        cleanupAnimation(tbody);
      };
    }
  };

  updateHistoryPaginationUI(page, totalPages);
  initPageIndicatorEditing(totalPages, isAllPoolsMode);
}

export function createHistoryTable(dataMap, poolName) {
  if (getCurrentPoolNameForPagination() !== poolName) {
    setCurrentHistoryPage(1);
    setCurrentPoolNameForPagination(poolName);
  }
  const items = dataMap[poolName].slice();
  // 为每条记录保留原始序号（筛选时不重新编号）
  items.forEach((item, index) => { originalNumMap.set(item, items.length - index); });
  setCurrentHistoryData(items);
  initFilterBar();
  renderHistoryPage();
}

export function renderHistoryPage(direction = null) {
  renderPagedHistoryTable({
    items: getCurrentHistoryData(),
    isAllPoolsMode: false,
    getPoolLabel: () => getCurrentPoolNameForPagination(),
    emptyMessage: t('noData.history'),
    emptyColspan: 5,
    direction
  });
}

export function createAllPoolsHistoryTable(allItems) {
  if (!allItems || !Array.isArray(allItems) || allItems.length === 0) allItems = [];

  setCurrentHistoryPage(1);
  const sorted = allItems.slice();
  sorted.forEach((item, index) => { originalNumMap.set(item, sorted.length - index); });
  setCurrentHistoryData(sorted);
  initFilterBar();
  renderAllPoolsHistoryPage();
}

export function renderAllPoolsHistoryPage(direction = null) {
  renderPagedHistoryTable({
    items: getCurrentHistoryData(),
    isAllPoolsMode: true,
    getPoolLabel: (item) => item.poolName,
    emptyMessage: t('noData.history'),
    emptyColspan: 5,
    direction
  });
}

export function changePage(delta) {
  const currentPage = getCurrentHistoryPage();
  const filtered = applyFilters(getCurrentHistoryData());
  const totalPages = Math.ceil(filtered.length / getHistoryPageSize()) || 1;
  if ((currentPage + delta < 1) || (currentPage + delta > totalPages)) return;
  setCurrentHistoryPage(getCurrentHistoryPage() + delta);
  const direction = delta > 0 ? 'left' : 'right';
  if (getIsAllPoolsMode()) {
    renderAllPoolsHistoryPage(direction);
  } else {
    renderHistoryPage(direction);
  }
}

// 初始化页码编辑功能
function initPageIndicatorEditing(totalPages, isAllPoolsMode) {
  const pageIndicator = document.getElementById('pageIndicator');
  if (!pageIndicator) return;

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

  const inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 8px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.value = getCurrentHistoryPage();
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

  pageIndicator.innerHTML = '';
  pageIndicator.appendChild(inputWrapper);
  input.focus();
  input.select();

  const confirmJump = () => {
    const newPage = parseInt(input.value, 10);

    if (isNaN(newPage) || newPage < 1 || newPage > totalPages) {
      showAppSnackbar({
        message: t('pagination.invalidPage', { total: totalPages }),
        type: "warning"
      });
      pageIndicator.textContent = originalText;
      return;
    }

    if (newPage !== getCurrentHistoryPage()) {
      setCurrentHistoryPage(newPage);
      if (isAllPoolsMode) {
        renderAllPoolsHistoryPage();
      } else {
        renderHistoryPage();
      }
    } else {
      pageIndicator.textContent = originalText;
    }
  };

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

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.getElementById('pageIndicator').contains(input)) {
        confirmJump();
      }
    }, 100);
  });
}
