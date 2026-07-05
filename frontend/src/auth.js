import { SNACKBAR_AUTO_CLOSE } from './constants.js';
import { getCachedHgToken, setCachedHgToken, setCurrentServerType } from './state.js';
import { showAppSnackbar, resetButton, showLoadingState, setFetchingState } from './utils.js';
import { OpenOfficialLoginWindow, LoginAndFetchPlayers, SyncDataByChoice } from "../wailsjs/go/main/App";

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
  btn.textContent = "WAITING FOR LOGIN...";
  btn.disabled = true;
  document.getElementById("analyzeError").textContent = "";
  try {
    const res = await OpenOfficialLoginWindow();
    console.log("Login Success:", res);
    setCachedHgToken(res.hgToken);
    if (res.players && res.players.length === 1) {
      await doTokenSync(res.players[0]);
    } else {
      renderPlayerList(res.players);
      document.getElementById("tokenInputArea").style.display = "none";
      document.getElementById("playerSelectArea").style.display = "block";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("analyzeError").textContent = "LOGIN CANCELLED / FAILED";
  } finally {
    resetButton(btn, originalText);
  }
}

// 点击 CONNECT 按钮，执行第一步登录
export async function handleToken() {
  const input = document.getElementById("webTokenInput");
  const token = input.value.trim();
  if (!token) {
    document.getElementById("analyzeError").textContent = "ERR: TOKEN_EMPTY // 请输入 Token";
    return;
  }

  input.disabled = true;
  const btn = document.getElementById("btnManualConnect");
  const orgText = btn.textContent;
  btn.textContent = "CONNECTING...";
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
    console.error(err);
    showAppSnackbar({
      message: "[ERROR] 处理 Token 失败: " + err,
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
    const div = document.createElement("div");
    div.className = "player-card";
    div.innerHTML = `
      <div class="player-info">
        <span class="p-name">${p.nickName} <span style="font-size:10px;color:#888;">Lv.${p.level}</span></span>
        <span class="p-uid">UID: ${p.uid}</span>
      </div>
      <div class="p-tag" style="border-color: ${p.channelName === "官服" ? 'var(--ef-yellow)' : '#23ade5'}; color: ${p.channelName === "官服" ? 'var(--ef-yellow)' : '#23ade5'}">
        ${p.channelName === "官服" ? "OFFICIAL" : "BILIBILI"}
      </div>
    `;
    div.onclick = () => doTokenSync(p);
    container.appendChild(div);
  });
}

// 执行最终同步
export async function doTokenSync(player) {
  document.getElementById("tokenInputArea").style.display = "none";
  document.getElementById("playerSelectArea").style.display = "none";
  const serverName = player.serverType;
  setCurrentServerType(serverName);
  showLoadingState("SYSTEM SYNCHRONIZING...", `UID: ${player.uid} // ${serverName.toUpperCase()}`);
  setFetchingState(true);
  try {
    const res = await SyncDataByChoice(getCachedHgToken(), player.uid, serverName);
    if (res === "success") {
      setTimeout(async () => {
        await dataLoader(true, serverName, player.uid);
      }, 1000);
    }
  } catch (err) {
    setFetchingState(false);
    console.error(err);
    document.getElementById("analyzeError").textContent = "SYNC ERR: " + err;
    window.resetToAnalyze();
  }
}
