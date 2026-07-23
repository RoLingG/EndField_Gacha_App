import { getGlobalLang } from './state.js';

let messages = {};

// 加载语言包
export async function loadLocale(lang) {
  try {
    const res = await fetch(`./src/locales/${lang}.json`);
    messages = await res.json();
  } catch (err) {
    console.warn(`Failed to load locale "${lang}":`, err);
    messages = {};
  }
}

// 翻译函数：t('menu.reload') → "[ SYSTEM_RELOAD ]"
// 支持插值：t('stats.total6Star', { count: 5 }) → "共 5 个 6★"
export function t(key, params) {
  let msg = messages[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return msg;
}

// 扫描 DOM 中 data-i18n 属性并替换文本
export function applyToDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
}
