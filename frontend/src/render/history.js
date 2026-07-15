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

  if (pageInfo) pageInfo.textContent = `PAGE ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages || totalPages === 0);
}

// 根据筛选状态过滤数据
function applyFilters(items) {
  const searchText = getFilterSearchText().toLowerCase();
  const rarity = getFilterRarity();
  const isFree = getFilterIsFree();

  return items.filter(item => {
    if (searchText) {
      const name = getItemName(item).toLowerCase();
      if (!name.includes(searchText)) return false;
    }
    if (rarity > 0 && item.rarity !== rarity) return false;
    if (isFree === 0 && item.isFree) return false;
    if (isFree === 1 && !item.isFree) return false;
    return true;
  });
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

// 统一渲染卡池历史记录分页
export function renderPagedHistoryTable({
  items,
  isAllPoolsMode,
  getPoolLabel = () => 'UNKNOWN',
  emptyMessage = 'NO DATA AVAILABLE',
  emptyColspan = 5
}) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

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

  if (pageItems.length === 0) {
    renderEmptyHistoryTable(emptyMessage, emptyColspan);
  } else {
    pageItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      const displayNum = item._originalNum || (totalItems - (startIndex + index));
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
  items.forEach((item, index) => { item._originalNum = items.length - index; });
  setCurrentHistoryData(items);
  initFilterBar();
  renderHistoryPage();
}

export function renderHistoryPage() {
  renderPagedHistoryTable({
    items: getCurrentHistoryData(),
    isAllPoolsMode: false,
    getPoolLabel: () => getCurrentPoolNameForPagination(),
    emptyMessage: 'NO DATA AVAILABLE',
    emptyColspan: 5
  });
}

export function createAllPoolsHistoryTable(items) {
  setCurrentHistoryPage(1);
  const sliced = items.slice();
  sliced.forEach((item, index) => { item._originalNum = sliced.length - index; });
  setCurrentHistoryData(sliced);
  initFilterBar();
  renderAllPoolsHistoryPage();
}

export function renderAllPoolsHistoryPage() {
  renderPagedHistoryTable({
    items: getCurrentHistoryData(),
    isAllPoolsMode: true,
    getPoolLabel: (item) => item.poolName,
    emptyMessage: 'NO DATA AVAILABLE',
    emptyColspan: 5
  });
}

export function changePage(delta) {
  setCurrentHistoryPage(getCurrentHistoryPage() + delta);
  if (getIsAllPoolsMode()) {
    renderAllPoolsHistoryPage();
  } else {
    renderHistoryPage();
  }
}

// 初始化页码编辑功能（双击可编辑）
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
        message: `[WARNING] Invalid page number. Please enter a number between 1 and ${totalPages}`,
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
