import {
  getCurrentHistoryPage, setCurrentHistoryPage, getHistoryPageSize,
  getCurrentHistoryData, setCurrentHistoryData, getIsAllPoolsMode,
  setCurrentPoolNameForPagination, getCurrentPoolNameForPagination,
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

  const totalItems = items.length;
  const pageSize = getHistoryPageSize();
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  let page = getCurrentHistoryPage();
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  setCurrentHistoryPage(page);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
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

  updateHistoryPaginationUI(page, totalPages);
  initPageIndicatorEditing(totalPages, isAllPoolsMode);
}

export function createHistoryTable(dataMap, poolName) {
  if (getCurrentPoolNameForPagination() !== poolName) {
    setCurrentHistoryPage(1);
    setCurrentPoolNameForPagination(poolName);
  }
  const items = dataMap[poolName];
  setCurrentHistoryData(items.slice());
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
  setCurrentHistoryData(items.slice());
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
