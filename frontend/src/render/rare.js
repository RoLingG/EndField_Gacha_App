import { calculateSixStarDetails } from '../data.js';
import { getCurrentType, getGlobalPoolConfig } from '../state.js';
import { t } from '../i18n.js';

function renderRareItemChip({
  label,
  isUpItem,
  isNewItem,
  chipBorderColor,
  chipTextColor,
  chipBgColor,
  cornerBadge
}) {
  let borderColor, textColor, bgColor;
  let hasGlowEffect = false;
  if (isUpItem) {
    borderColor = chipBorderColor;
    textColor = chipTextColor;
    bgColor = chipBgColor;
    if (isNewItem) {
      hasGlowEffect = true;
    }
  } else if (isNewItem) {
    borderColor = "#e8a035";
    textColor = "#e8a035";
    bgColor = "rgba(255, 235, 59, 0.15)";
  } else {
    borderColor = "#666666";
    textColor = "#888888";
    bgColor = "#66666619";
  }
  const chipStyle = `padding: 5px 10px; font-size: 12px; font-weight: bold; font-family: 'Consolas'; white-space: nowrap; color: ${textColor}; background: ${bgColor};`;
  const glowClass = hasGlowEffect ? 'class="glow-up-new"' : '';
  if (cornerBadge) {
    return `<span ${glowClass} style="display:inline-flex; align-items:stretch; margin:4px; border:1px solid ${borderColor}; border-radius:3px; overflow:hidden; font-family:'Consolas';">` +
      `<span style="display:flex; align-items:center; ${chipStyle}">${label}</span>` +
      `<span style="display:flex; align-items:center; padding:5px 8px; background:${bgColor}; color:${textColor}; font-size:11px; font-weight:bold; border-left:1px solid ${borderColor}; white-space:nowrap;">+${cornerBadge}</span>` +
      `</span>`;
  }
  return `<span ${glowClass} style="display:inline-block; margin:4px; border:1px solid ${borderColor}; border-radius:3px; ${chipStyle}">${label}</span>`;
}

function renderRareRecordsCard(options) {
  const {
    sixStarDetails,
    headerText,
    titleText,
    countLabel,
    countValue,
    labelText,
    getChipLabel,
    getUpCharName,
  } = options;

  const container = document.getElementById("rareCharsContainer");
  container.style.padding = "24px";
  const accentColor = "var(--ef-accent)";
  const textStrong = "var(--ef-text-strong)";
  const textMuted = "var(--ef-text-muted)";
  const emptyColor = "var(--ef-empty)";
  const chipBorderColor = "var(--ef-chip-border)";
  const chipTextColor = "var(--ef-chip-text)";
  const chipBgColor = "var(--ef-chip-bg)";

  const chipsHtml = sixStarDetails.map(item => {
    const upCharName = getUpCharName ? getUpCharName(item) : null;
    const isUpItem = upCharName && item.name === upCharName;
    return renderRareItemChip({
      label: getChipLabel(item),
      isUpItem,
      isNewItem: item.isNew,
      chipBorderColor, chipTextColor, chipBgColor,
      cornerBadge: item.inheritedPity
    });
  }).join("");

  const emptyHtml = `<span style="color:${emptyColor}; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;
  container.style.borderLeft = `4px solid ${accentColor}`;
  container.innerHTML = `
    <div style="margin-left: 8px;">
      <div style="font-size:10px; color:${textMuted}; font-family:'Consolas'; letter-spacing:1px; margin-bottom:4px;">${headerText}</div>
      <div style="font-size:18px; font-weight:bold; color:${accentColor}; margin-bottom:12px; font-family:'Consolas'; text-transform:uppercase;">${titleText}</div>
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #777; padding-bottom:12px; margin-bottom:12px;">
        <div style="font-size:16px; font-weight: bold; color:${textStrong};">${countLabel}</div>
        <div style="font-size:16px; font-weight: bold; color:${textStrong};">${countValue}</div>
      </div>
      <div>
        <div style="font-size:10px; color:${textMuted}; margin-bottom:8px; font-family:'Consolas';">// ${labelText}</div>
        <div style="display:flex; flex-wrap:wrap; margin-left:-4px;">
          ${sixStarDetails.length > 0 ? chipsHtml : emptyHtml}
        </div>
      </div>
    </div>
  `;
}

export function createRareRecordCard(dataMap, poolName) {
  const items = dataMap[poolName] || [];
  const currentType = getCurrentType();
  const allItems = Object.values(dataMap).flat();
  const sixStarDetails = calculateSixStarDetails(items, true, allItems);
  const labelText = (currentType === 'char') ? t('rare.recent6Char') : t('rare.recent6Weapon');

  renderRareRecordsCard({
    sixStarDetails,
    headerText: t('rare.targetPoolIdentified'),
    titleText: poolName,
    countLabel: t('rare.totalRecords'),
    countValue: items.length,
    labelText,
    getChipLabel: (item) => `${item.name} [${item.pityText}]`,
    getUpCharName: () => {
      const config = getGlobalPoolConfig();
      return config && config[poolName] ? config[poolName] : null;
    },
  });
}

export function createAllPoolsRareRecordsCard(items) {
  if (!items || !Array.isArray(items) || items.length === 0) items = [];
  const currentType = getCurrentType();
  const sixStarDetails = calculateSixStarDetails(items, true);
  const labelText = (currentType === 'char') ? t('rare.all6Char') : t('rare.all6Weapon');

  renderRareRecordsCard({
    sixStarDetails,
    headerText: t('rare.allPoolsAnalysis'),
    titleText: t('rare.allPoolsTitle'),
    countLabel: t('rare.total6Records'),
    countValue: sixStarDetails.length,
    labelText,
    getChipLabel: (item) => `${item.name} - ${item.poolName} [${item.pityText}]`,
    getUpCharName: (item) => {
      const config = getGlobalPoolConfig();
      return config && config[item.poolName] ? config[item.poolName] : null;
    },
  });
}
