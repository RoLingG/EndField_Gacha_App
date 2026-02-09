package main

import (
	"Go_Arknights_Gacha_App/internal/api"
	"Go_Arknights_Gacha_App/internal/auth"
	"Go_Arknights_Gacha_App/internal/export"
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"Go_Arknights_Gacha_App/internal/storage"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
	"net/url"
	"os/exec"
	runtimeOs "runtime"
)

// App struct
type App struct {
	ctx          context.Context
	cachedTokens model.ServerTokens
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.appSystray()
}

// ================= Window Controls =================

func (a *App) ReloadFrontend() {
	wailsRuntime.WindowReload(a.ctx)
}

func (a *App) WindowMinSize() {
	wailsRuntime.WindowMinimise(a.ctx)
}

func (a *App) WindowToggleMaxSize() bool {
	isMax := wailsRuntime.WindowIsMaximised(a.ctx)
	if isMax {
		wailsRuntime.WindowUnmaximise(a.ctx)
	} else {
		wailsRuntime.WindowMaximise(a.ctx)
	}
	return isMax
}

func (a *App) WindowClose() {
	wailsRuntime.Quit(a.ctx)
}

// ================= File System Operations =================

// OpenDataFolder 打开存放 JSON 数据的文件夹
func (a *App) OpenDataFolder() {
	dir, err := storage.GetStorageDir()
	if err != nil {
		logger.Log.Error("Failed to get storage dir", zap.Error(err))
		return
	}
	logger.Log.Info("User requested to open data folder", zap.String("path", dir))

	var cmd *exec.Cmd
	switch runtimeOs.GOOS {
	case "windows":
		cmd = exec.Command("explorer", dir)
	case "darwin":
		cmd = exec.Command("open", dir)
	default: // linux
		cmd = exec.Command("xdg-open", dir)
	}

	if err := cmd.Start(); err != nil {
		logger.Log.Error("Failed to open folder explorer", zap.Error(err))
	}
}

// ExportData 导出数据为 Excel
func (a *App) ExportData(uid string, serverType string) (string, error) {
	logger.Log.Info("Frontend requested: ExportData", zap.String("uid", uid), zap.String("server", serverType))

	charList, err := storage.ReadData[model.EndFieldCharInfo](uid, serverType, model.PoolTypeChar)
	if err != nil {
		charList = []model.EndFieldCharInfo{}
	}

	weaponList, err := storage.ReadData[model.EndFieldWeaponInfo](uid, serverType, model.PoolTypeWeapon)
	if err != nil {
		weaponList = []model.EndFieldWeaponInfo{}
	}

	if len(charList) == 0 && len(weaponList) == 0 {
		return "", fmt.Errorf("当前没有任何数据可导出")
	}

	defaultName := fmt.Sprintf("endfield_data_%s.xlsx", serverType)
	if uid != "" {
		defaultName = fmt.Sprintf("endfield_data_%s_%s.xlsx", uid, serverType)
	}

	savePath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "导出抽卡记录",
		DefaultFilename: defaultName,
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Excel Files (*.xlsx)", Pattern: "*.xlsx"},
		},
	})

	if err != nil {
		logger.Log.Error("Failed to open save dialog", zap.Error(err))
		return "", err
	}
	if savePath == "" {
		return "cancelled", nil
	}

	if err := export.SaveToExcel(savePath, charList, weaponList); err != nil {
		logger.Log.Error("Export failed", zap.Error(err))
		return "", fmt.Errorf("导出文件失败: %v", err)
	}
	return "success", nil
}

// ================= Auth & Login =================

type LoginResponse struct {
	HgToken string                    `json:"hgToken"`
	Players []model.PlayerBindingInfo `json:"players"`
}

// LoginAndFetchPlayers 登录并获取绑定角色
func (a *App) LoginAndFetchPlayers(shortToken string) (LoginResponse, error) {
	logger.Log.Info("Frontend requested: LoginAndFetchPlayers")
	hgToken, err := api.GetGrantToken(shortToken)
	if err != nil {
		return LoginResponse{}, err
	}
	players, err := api.GetPlayerBindings(hgToken)
	if err != nil {
		return LoginResponse{}, err
	}
	return LoginResponse{
		HgToken: hgToken,
		Players: players,
	}, nil
}

// SyncDataByChoice 前端选好角色后，手动同步数据
func (a *App) SyncDataByChoice(hgToken string, uid string, serverType string) (string, error) {
	logger.Log.Info("Frontend requested: SyncDataByChoice", zap.String("uid", uid), zap.String("server", serverType))
	u8Token, err := api.GetU8Token(hgToken, uid)
	if err != nil {
		return "", err
	}
	return a.internalFetchAndSave(u8Token, "1", "zh-cn", uid, serverType)
}

// internalFetchAndSave 内部同步逻辑
func (a *App) internalFetchAndSave(token, serverID, lang string, uid string, serverType string) (string, error) {
	charData, err := api.FetchCharDataAll(token, serverID, lang)
	if err != nil {
		return "", fmt.Errorf("角色记录抓取失败: %v", err)
	}
	if _, err := storage.MergeAndSaveData(charData, uid, serverType, model.PoolTypeChar); err != nil {
		logger.Log.Warn("Character save warning", zap.Error(err))
	}

	weaponData, err := api.FetchWeaponDataAll(token, serverID, lang)
	if err != nil {
		return "", fmt.Errorf("武器记录抓取失败: %v", err)
	}
	if _, err := storage.MergeAndSaveData(weaponData, uid, serverType, model.PoolTypeWeapon); err != nil {
		logger.Log.Warn("Weapon save warning", zap.Error(err))
	}

	return "success", nil
}

// ================= Token Scanning (Log Mode) =================

// LoadGachaTokens 扫描日志获取 Token
func (a *App) LoadGachaTokens() (model.ServerTokens, error) {
	logger.Log.Info("Frontend requested: LoadGachaTokens")

	tokens, err := api.ScanLogForTokens()
	if err != nil {
		logger.Log.Error("Token scan failed", zap.Error(err))
		a.cachedTokens = model.ServerTokens{}
		return model.ServerTokens{}, fmt.Errorf("扫描失败: %v。请先在游戏中打开抽卡历史记录。", err)
	}

	logger.Log.Info("Tokens loaded successfully",
		zap.Bool("official_found", tokens.Official != ""),
		zap.Bool("bilibili_found", tokens.Bilibili != ""),
	)

	// 更新 App 内部缓存
	a.cachedTokens = tokens
	return tokens, nil
}

// ================= Fetch Data (Log Mode) =================

// prepareFetchParams 统一处理从 Token 获取到解析参数的流程
func (a *App) prepareFetchParams(serverType string) (token, serverID, lang string, err error) {
	fullURL := a.getTokenByServerType(serverType)
	if fullURL == "" {
		return "", "", "", fmt.Errorf("未找到 %s 的 Token", serverType)
	}
	token, serverID, lang, err = a.parseParamsFromURL(fullURL)
	if err != nil {
		return "", "", "", fmt.Errorf("Token 解析失败: %v", err)
	}
	return token, serverID, lang, nil
}

// GetCharacterData 获取并保存角色数据
func (a *App) GetCharacterData(serverType string) ([]model.EndFieldCharInfo, error) {
	logger.Log.Info("Frontend requested: GetCharacterData", zap.String("server", serverType))
	// 获取 params 参数
	token, serverID, lang, err := a.prepareFetchParams(serverType)
	if err != nil {
		return nil, err
	}
	uid, err := api.GetUIDByU8Token(token, serverID)
	if err != nil {
		logger.Log.Warn("Failed to resolve UID from Token, using fallback", zap.Error(err))
		uid = ""
		return nil, err
	}
	// 联网请求
	newData, err := api.FetchCharDataAll(token, serverID, lang)
	if err != nil {
		logger.Log.Error("Network request failed", zap.Error(err))
		return nil, fmt.Errorf("数据请求失败: %v", err)
	}
	mergedData, err := storage.MergeAndSaveData(newData, uid, serverType, model.PoolTypeChar)
	if err != nil {
		logger.Log.Warn("Failed to save data", zap.Error(err))
		return newData, nil
	}
	return mergedData, nil
}

// GetWeaponData 获取并保存武器数据
func (a *App) GetWeaponData(serverType string) ([]model.EndFieldWeaponInfo, error) {
	logger.Log.Info("Frontend requested: GetWeaponData", zap.String("server", serverType))
	// 获取 params 参数
	token, serverID, lang, err := a.prepareFetchParams(serverType)
	if err != nil {
		return nil, err
	}
	uid, err := api.GetUIDByU8Token(token, serverID)
	if err != nil {
		logger.Log.Warn("Failed to resolve UID from Token, using fallback", zap.Error(err))
		uid = ""
		return nil, err
	}
	newData, err := api.FetchWeaponDataAll(token, serverID, lang)
	if err != nil {
		logger.Log.Error("Network request failed", zap.Error(err))
		return nil, fmt.Errorf("数据请求失败: %v", err)
	}
	mergedData, err := storage.MergeAndSaveData(newData, uid, serverType, model.PoolTypeWeapon)
	if err != nil {
		logger.Log.Warn("Failed to save data", zap.Error(err))
		return newData, nil
	}
	return mergedData, nil
}

// parseParamsFromURL 辅助解析
func (a *App) parseParamsFromURL(rawURL string) (token, serverID, lang string, err error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", "", "", fmt.Errorf("URL 解析失败")
	}
	q := u.Query()
	token = q.Get("u8_token")
	if token == "" {
		token = q.Get("token")
	}
	if token == "" {
		return "", "", "", fmt.Errorf("URL 中缺少 Token")
	}
	serverID = q.Get("server")
	if serverID == "" {
		serverID = "1"
	}
	lang = q.Get("lang")
	if lang == "" {
		lang = "zh-cn"
	}
	return token, serverID, lang, nil
}

func (a *App) getTokenByServerType(serverType string) string {
	if serverType == "bilibili" {
		return a.cachedTokens.Bilibili
	}
	return a.cachedTokens.Official
}

// ================= Offline / Local Data =================

type LocalDataResponse struct {
	CharJson   string `json:"char"`
	WeaponJson string `json:"weapon"`
}

// CheckLocalFiles 检查本地文件是否存在
func (a *App) CheckLocalFiles() ([]model.LocalArchive, error) {
	logger.Log.Info("Frontend requested: CheckLocalFiles")
	archives, err := api.ScanLocalArchives()
	if err != nil {
		logger.Log.Error("Failed to scan local archives", zap.Error(err))
		return []model.LocalArchive{}, err
	}
	return archives, nil
}

// LoadLocalGachaHistory 读取本地历史
func (a *App) LoadLocalGachaHistory(uid string, serverType string) (LocalDataResponse, error) {
	logger.Log.Info("Frontend requested: LoadLocalGachaHistory", zap.String("server", serverType))

	charList, _ := storage.ReadData[model.EndFieldCharInfo](uid, serverType, model.PoolTypeChar)
	weaponList, _ := storage.ReadData[model.EndFieldWeaponInfo](uid, serverType, model.PoolTypeWeapon)

	charJson := "{}"
	if len(charList) > 0 {
		grouped := groupByCharPoolName(charList)
		if b, err := json.MarshalIndent(grouped, "", "  "); err == nil {
			charJson = string(b)
		}
	}

	weaponJson := "{}"
	if len(weaponList) > 0 {
		grouped := groupByWeaponPoolName(weaponList)
		if b, err := json.MarshalIndent(grouped, "", "  "); err == nil {
			weaponJson = string(b)
		}
	}

	return LocalDataResponse{
		CharJson:   charJson,
		WeaponJson: weaponJson,
	}, nil
}

// OpenOfficialLoginWindow 用户输入自主登录官网获取 Token
func (a *App) OpenOfficialLoginWindow() (LoginResponse, error) {
	logger.Log.Info("Frontend requested: OpenOfficialLoginWindow")
	token, err := auth.OpenLoginWindow()
	if err != nil {
		logger.Log.Warn("Login window closed or failed", zap.Error(err))
		return LoginResponse{}, err
	}
	logger.Log.Info("Token retrieved successfully", zap.String("token_part", token[:10]+"..."))
	hgToken, err := api.GetGrantToken(token)
	if err != nil {
		logger.Log.Error("Failed to exchange grant token", zap.Error(err))
		return LoginResponse{}, fmt.Errorf("hgToken 获取失败: %v", err)
	}
	logger.Log.Info("Grant Token exchanged successfully")
	players, err := api.GetPlayerBindings(hgToken)
	if err != nil {
		logger.Log.Error("Failed to fetch players with token", zap.Error(err))
		return LoginResponse{}, err
	}
	return LoginResponse{
		HgToken: hgToken,
		Players: players,
	}, nil
}

// ================= Data Grouping Helpers =================

func groupByCharPoolName(data []model.EndFieldCharInfo) map[string][]model.EndFieldCharInfo {
	groupedData := make(map[string][]model.EndFieldCharInfo)
	for _, item := range data {
		key := item.PoolName
		groupedData[key] = append(groupedData[key], item)
	}
	return groupedData
}

func groupByWeaponPoolName(data []model.EndFieldWeaponInfo) map[string][]model.EndFieldWeaponInfo {
	groupedData := make(map[string][]model.EndFieldWeaponInfo)
	for _, item := range data {
		key := item.PoolName
		groupedData[key] = append(groupedData[key], item)
	}
	return groupedData
}

// ================= System Tray =================

//go:embed frontend/src/assets/icons/home.ico
var homeIcon []byte

//go:embed frontend/src/assets/icons/show.ico
var showIcon []byte

//go:embed frontend/src/assets/icons/hide.ico
var hideIcon []byte

//go:embed frontend/src/assets/icons/reload.ico
var reloadIcon []byte

//go:embed frontend/src/assets/icons/quit.ico
var quitIcon []byte

func (a *App) appSystray() {
	systray.Run(a.onReady, a.onExit)
}

func (a *App) onReady() {
	systray.SetIcon(homeIcon)
	systray.SetTitle("EndField Gacha History")
	systray.SetTooltip("EndField Gacha History")

	systray.SetOnClick(func(menu systray.IMenu) {
		wailsRuntime.Show(a.ctx)
	})

	showMenu := systray.AddMenuItem("显示", "Show the gacha app")
	showMenu.SetIcon(showIcon)
	showMenu.Click(func() {
		go wailsRuntime.Show(a.ctx)
	})

	hideMenu := systray.AddMenuItem("隐藏", "Hide the gacha app")
	hideMenu.SetIcon(hideIcon)
	hideMenu.Click(func() {
		go wailsRuntime.Hide(a.ctx)
	})

	reloadMenu := systray.AddMenuItem("重置", "Reload the gacha app")
	reloadMenu.SetIcon(reloadIcon)
	reloadMenu.Click(func() {
		go a.ReloadFrontend()
	})

	quitMenu := systray.AddMenuItem("退出", "Quit the gacha app")
	quitMenu.SetIcon(quitIcon)
	quitMenu.Click(func() {
		a.onExit()
	})
}

func (a *App) onExit() {
	systray.Quit()
	wailsRuntime.Quit(a.ctx)
}
