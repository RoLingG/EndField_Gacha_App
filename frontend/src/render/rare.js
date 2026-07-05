import { calculateSixStarDetails } from '../data.js';
import { getCurrentType, getGlobalPoolConfig } from '../state.js';

function renderRareItemChip({
  label,
  isUpItem,
  isNewItem,
  chipBorderColor,
  chipTextColor,
  chipBgColor
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
  const styleStr = `display: inline-block; border: 1px solid ${borderColor}; color: ${textColor};
  background: ${bgColor}; padding: 4px 10px; margin: 4px; font-size: 12px; font-weight: bold; font-family: 'Consolas';`;
  const glowClass = hasGlowEffect ? 'class="glow-up-new"' : '';
  return `<span ${glowClass} style="${styleStr}">${label}</span>`;
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
      chipBorderColor, chipTextColor, chipBgColor
    });
  }).join("");

  const emptyHtml = `<span style="color:${emptyColor}; font-style:italic; font-size:12px;">// NO SIGNAL DETECTED</span>`;
  container.innerHTML = `
    <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${accentColor};"></div>
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
  const sixStarDetails = calculateSixStarDetails(items, true);
  const labelText = (getCurrentType() === 'char') ? "RECENT 6★ CHARACTERS" : "RECENT 6★ WEAPONS";

  renderRareRecordsCard({
    sixStarDetails,
    headerText: "TARGET POOL IDENTIFIED",
    titleText: poolName,
    countLabel: "TOTAL RECORDS:",
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
  const sixStarDetails = calculateSixStarDetails(items);
  const labelText = (getCurrentType() === 'char') ? "ALL 6★ CHARACTERS" : "ALL 6★ WEAPONS";

  renderRareRecordsCard({
    sixStarDetails,
    headerText: "ALL POOLS ANALYSIS",
    titleText: "历史汇总",
    countLabel: "TOTAL 6★ RECORDS:",
    countValue: sixStarDetails.length,
    labelText,
    getChipLabel: (item) => `${item.name} - ${item.poolName} [${item.pityText}]`,
    getUpCharName: (item) => {
      const config = getGlobalPoolConfig();
      return config && config[item.poolName] ? config[item.poolName] : null;
    },
  });
}
