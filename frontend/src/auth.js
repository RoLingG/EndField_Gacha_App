import { SNACKBAR_AUTO_CLOSE } from './constants.js';
import { getCachedHgToken, setCachedHgToken, setCurrentServerType } from './state.js';
import { showAppSnackbar, resetButton, showLoadingState, setFetchingState } from './utils.js';
import { OpenOfficialLoginWindow, LoginAndFetchPlayers, SyncDataByChoice } from "../wailsjs/go/main/App";
import { t } from './i18n.js';

// 通过回调注入 initApp，避免与 loader.js 循环依赖
let dataLoader = null;
export function setDataLoader(fn) {
  dataLoader = fn;
}

// 点击 WEB TOKEN SYNC 按钮，显示输入界面
export function showTokenInputUI() {
  document.getElementById("defaultBtnGroup").style.display = "none";
  document.getElementById("analyzeDescription").style.display = "none";
  document.getElementById("tokenInputArea").style.display = "block";
  document.getElementById("webTokenInput").focus();
  document.getElementById("analyzeError").textContent = "";
}

// 处理官方登录窗口按钮点击
export async function handleOfficialLoginWindow() {
  const btn = document.getElementById("btnLoginWindow");
  const originalText = btn.textContent;
  btn.textContent = t('login.status.waiting');
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";
  try {
    const res = await OpenOfficialLoginWindow();
    setCachedHgToken(res.hgToken);
    if (res.players && res.players.length === 1) {
      await doTokenSync(res.players[0]);
    } else {
      renderPlayerList(res.players);
      document.getElementById("tokenInputArea").style.display = "none";
      document.getElementById("playerSelectArea").style.display = "block";
    }
  } catch (err) {
    document.getElementById("analyzeError").textContent = t('login.error.loginCancelled');
  } finally {
    resetButton(btn, originalText);
  }
}

// 点击 CONNECT 按钮，执行第一步登录
export async function handleToken() {
  const input = document.getElementById("webTokenInput");
  const token = input.value.trim();
  if (!token) {
    document.getElementById("analyzeError").textContent = t('login.error.tokenEmpty');
    return;
  }

  input.disabled = true;
  const btn = document.getElementById("btnManualConnect");
  const orgText = btn.textContent;
  btn.textContent = t('login.status.connecting');
  try {
    const res = await LoginAndFetchPlayers(token);
    setCachedHgToken(res.hgToken);
    if (res.players && res.players.length === 1) {
      await doTokenSync(res.players[0]);
      return;
    }
    renderPlayerList(res.players);
    document.getElementById("tokenInputArea").style.display = "none";
    document.getElementById("playerSelectArea").style.display = "block";
  } catch (err) {
    showAppSnackbar({
      message: t('snackbar.tokenFailed') + err,
      type: "error",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    });
    document.getElementById("analyzeError").textContent = "LOGIN ERR: " + err;
    window.resetToAnalyze();
    input.disabled = false;
    btn.textContent = orgText;
  }
}

// 渲染角色列表
export function renderPlayerList(players) {
  const container = document.getElementById("playerListContainer");
  container.innerHTML = "";

  players.forEach(p => {
    const isOfficial = p.channelName === t('server.official');
    const accentColor = isOfficial ? "var(--ef-yellow)" : "#23ade5";

    const card = document.createElement("div");
    card.className = "player-card";

    const info = document.createElement("div");
    info.className = "player-info";

    const name = document.createElement("span");
    name.className = "p-name";
    name.textContent = p.nickName;

    const level = document.createElement("span");
    level.className = "p-level";
    level.textContent = `Lv.${p.level}`;
    name.append(" ", level);

    const uid = document.createElement("span");
    uid.className = "p-uid";
    uid.textContent = `UID: ${p.uid}`;

    info.append(name, uid);

    const tag = document.createElement("div");
    tag.className = "p-tag";
    tag.style.borderColor = accentColor;
    tag.style.color = accentColor;
    tag.textContent = isOfficial ? t('login.official') : t('login.bilibili');

    card.append(info, tag);
    card.onclick = () => doTokenSync(p);
    container.appendChild(card);
  });
}

// 执行最终同步
export async function doTokenSync(player) {
  document.getElementById("tokenInputArea").style.display = "none";
  document.getElementById("playerSelectArea").style.display = "none";
  const serverName = player.serverType;
  setCurrentServerType(serverName);
  showLoadingState(t('login.status.syncing'), `UID: ${player.uid} // ${serverName.toUpperCase()}`);
  setFetchingState(true);
  try {
    const res = await SyncDataByChoice(getCachedHgToken(), player.uid, serverName);
    if (res === "success") await dataLoader(true, serverName, player.uid);
  } catch (err) {
    setFetchingState(false);
    document.getElementById("analyzeError").textContent = "SYNC ERR: " + err;
    window.resetToAnalyze();
  }
}
