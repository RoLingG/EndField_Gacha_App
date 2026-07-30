// 需要参与入场/出场动画的 APP 主内容元素 ID
export const APP_ELEMENT_IDS = [
  "mainTitle", "typeSwitcher", "poolSelectorWrapper",
  "summaryStrip", "dashboardPanel", "statsPanel", "historySection"
];

// 游戏机制常量
export const JADE_PER_PULL = 500;           // 1抽 = 500嵌晶玉
export const JADE_PER_STONE = 75;           // 1衍质原石 = 75嵌晶玉
export const WEAPON_QUOTA_PER_TEN = 1980;   // 10连武器 = 1980配额
export const WEAPON_QUOTA_6STAR = 2000;     // 角色池 6★ → 2000 武库配额
export const WEAPON_QUOTA_5STAR = 200;      // 角色池 5★ → 200 武库配额
export const WEAPON_QUOTA_4STAR = 20;       // 角色池 4★ → 20 武库配额
export const SPARK_TIER1 = 120;             // 垫刀第一阶段阈值
export const SPARK_TIER2 = 240;             // 垫刀第二阶段阈值
export const PITY_BOOST_START = 65;         // 概率提升起始抽数
export const CHAR_BASE_RATE = 0.8;          // 角色池 6★ 基础概率
export const CHAR_HARD_PITY = 80;           // 角色池 6★ 硬保底上限

// UI 常量
export const SNACKBAR_AUTO_CLOSE = 4500;    // snackbar 自动关闭延迟 (ms)

// Fallback 卡池配置（API 加载失败时使用）
export const FALLBACK_POOL_CONFIG = {
  "熔火灼痕": "莱万汀",
  "轻飘飘的信使": "洁尔佩塔",
  "热烈色彩": "伊冯",
  "河流的女儿": "汤汤",
  "狼珀": "洛茜",
  "春雷动，万物生": "庄方宜",
  "拳出无悔": "弭弗",
  "逐罪者": "卡缪",
  "临渊望北": "诀",
};

export const FALLBACK_POOL_ORDER = [
  "熔火灼痕", "轻飘飘的信使", "热烈色彩", "河流的女儿",
  "狼珀", "春雷动，万物生", "拳出无悔", "逐罪者", "临渊望北",
];
