// 窗口状态
let isOfflineSelection = false;
let isFetching = false;

// 认证状态
let cachedHgToken = "";
let currentUid = "";
let currentServerType = "";

// 筛选状态
let filterSearchText = "";  // 搜索关键词
let filterRarity = 0;   // 0: 全部，3/4/5/6: 指定稀有度
let filterIsFree = -1;  // -1: 不筛选, 0: 非免费, 1: 免费

// 全局数据存储
let globalCharData = null;
let globalWeaponData = null;
let currentType = 'char';
let lastDataType = 'char';
let currentPool = null;
let currentAllPoolsData = null;
let isAllPoolsMode = false;
let gachaChartInstance = null;
let pityDistChartInstance = null;
let monthlyTrendChartInstance = null;

// 主题
let globalTheme = "night";
const themeStorageKey = "ef-theme";

// 卡池配置缓存
let globalPoolConfig = null;
let globalCharPoolOrder = [];
let globalWeaponPoolOrder = [];

// 分页逻辑
let currentHistoryPage = 1;
const historyPageSize = 10;
let currentHistoryData = [];
let currentPoolNameForPagination = "";

// ============================================
// Exported Getters & Setters
// ============================================

export function getIsOfflineSelection() { return isOfflineSelection; }
export function setIsOfflineSelection(v) { isOfflineSelection = v; }

export function getIsFetching() { return isFetching; }
export function setIsFetching(v) { isFetching = v; }

export function getCachedHgToken() { return cachedHgToken; }
export function setCachedHgToken(v) { cachedHgToken = v; }

export function getCurrentUid() { return currentUid; }
export function setCurrentUid(v) { currentUid = v; }

export function getCurrentServerType() { return currentServerType; }
export function setCurrentServerType(v) { currentServerType = v; }

export function getGlobalCharData() { return globalCharData; }
export function setGlobalCharData(v) { globalCharData = v; }

export function getGlobalWeaponData() { return globalWeaponData; }
export function setGlobalWeaponData(v) { globalWeaponData = v; }

export function getCurrentType() { return currentType; }
export function setCurrentType(v) { currentType = v; }

export function getLastDataType() { return lastDataType; }
export function setLastDataType(v) { lastDataType = v; }

export function getCurrentPool() { return currentPool; }
export function setCurrentPool(v) { currentPool = v; }

export function getCurrentAllPoolsData() { return currentAllPoolsData; }
export function setCurrentAllPoolsData(v) { currentAllPoolsData = v; }

export function getIsAllPoolsMode() { return isAllPoolsMode; }
export function setIsAllPoolsMode(v) { isAllPoolsMode = v; }

export function getGachaChartInstance() { return gachaChartInstance; }
export function setGachaChartInstance(v) { gachaChartInstance = v; }

export function getPityDistChartInstance() { return pityDistChartInstance; }
export function setPityDistChartInstance(v) { pityDistChartInstance = v; }

export function getMonthlyTrendChartInstance() { return monthlyTrendChartInstance; }
export function setMonthlyTrendChartInstance(v) { monthlyTrendChartInstance = v; }

export function getGlobalTheme() { return globalTheme; }
export function setGlobalTheme(v) { globalTheme = v; }

export function getThemeStorageKey() { return themeStorageKey; }

export function getGlobalPoolConfig() { return globalPoolConfig; }
export function setGlobalPoolConfig(v) { globalPoolConfig = v; }

export function getGlobalCharPoolOrder() { return globalCharPoolOrder; }
export function setGlobalCharPoolOrder(v) { globalCharPoolOrder = v; }

export function getGlobalWeaponPoolOrder() { return globalWeaponPoolOrder; }
export function setGlobalWeaponPoolOrder(v) { globalWeaponPoolOrder = v; }

export function getCurrentHistoryPage() { return currentHistoryPage; }
export function setCurrentHistoryPage(v) { currentHistoryPage = v; }

export function getHistoryPageSize() { return historyPageSize; }

export function getCurrentHistoryData() { return currentHistoryData; }
export function setCurrentHistoryData(v) { currentHistoryData = v; }

export function getCurrentPoolNameForPagination() { return currentPoolNameForPagination; }
export function setCurrentPoolNameForPagination(v) { currentPoolNameForPagination = v; }

export function getFilterSearchText() { return filterSearchText; }
export function setFilterSearchText(v) { filterSearchText = v; }

export function getFilterRarity() { return filterRarity; }
export function setFilterRarity(v) { filterRarity = v; }

export function getFilterIsFree() { return filterIsFree; }
export function setFilterIsFree(v) { filterIsFree = v; }
