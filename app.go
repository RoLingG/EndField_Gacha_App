// app.go
package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"os/exec"
	"runtime"

	"Go_Arknights_Gacha_App/utils"
	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.appSystray()
}

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

// OpenDataFolder 打开存放 JSON 数据的文件夹
func (a *App) OpenDataFolder() {
	dir, err := utils.GetStorageDir()
	if err != nil {
		utils.Log.Error("Failed to get storage dir", zap.Error(err))
		return
	}
	utils.Log.Info("User requested to open data folder", zap.String("path", dir))
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		// Windows 下使用 explorer 命令
		cmd = exec.Command("explorer", dir)
	} else if runtime.GOOS == "darwin" {
		// Mac
		cmd = exec.Command("open", dir)
	} else {
		// Linux
		cmd = exec.Command("xdg-open", dir)
	}
	if err := cmd.Start(); err != nil {
		utils.Log.Error("Failed to open folder explorer", zap.Error(err))
	}
}

// GlobalTokens 双服Token存储结构
var GlobalTokens utils.ServerTokens

// LoadGachaTokens 扫描日志，获取并缓存 Token
func (a *App) LoadGachaTokens() (utils.ServerTokens, error) {
	utils.Log.Info("Frontend requested: LoadGachaTokens")
	tokens, err := utils.GetGachaTokensFromLog()
	if err != nil {
		utils.Log.Error("Token scan failed", zap.Error(err))
		GlobalTokens = utils.ServerTokens{}
		return utils.ServerTokens{}, fmt.Errorf("扫描失败: %v。请先在游戏中打开抽卡历史记录。", err)
	}
	utils.Log.Info("Tokens loaded successfully",
		zap.Bool("official_found", tokens.Official != ""),
		zap.Bool("bilibili_found", tokens.Bilibili != ""),
	)
	// 更新全局缓存
	GlobalTokens = tokens
	return tokens, nil
}

// GetCharacterData 获取并保存角色数据 serverType: "official" | "bilibili"
func (a *App) GetCharacterData(serverType string) ([]utils.EndFieldCharInfo, error) {
	utils.Log.Info("Frontend requested: GetCharacterData", zap.String("server", serverType))
	targetToken := a.getTokenByServerType(serverType)
	if targetToken == "" {
		utils.Log.Warn("Operation aborted: Token missing", zap.String("server", serverType))
		return nil, fmt.Errorf("未找到 %s 的 Token，请尝试先点击刷新 Token", serverType)
	}
	// 联网请求数据
	newData, err := utils.GetEndFieldCharGachaDataAll(targetToken)
	if err != nil {
		utils.Log.Error("Network request failed",
			zap.String("server", serverType),
			zap.Error(err),
		)
		return nil, fmt.Errorf("数据请求失败: %v", err)
	}
	utils.Log.Info("Network data received", zap.Int("count", len(newData)))
	//合并并保存到本地 JSON，保证离线模式也能看到最新数据
	mergedData, err := utils.MergeAndSaveCharData(newData, serverType)
	if err != nil {
		utils.Log.Warn("Failed to save data to JSON", zap.Error(err))
		return newData, nil
	}
	utils.Log.Info("Process complete: Data merged and saved", zap.Int("total_records", len(mergedData)))
	return mergedData, nil
}

// GetWeaponData 获取并保存武器数据
func (a *App) GetWeaponData(serverType string) ([]utils.EndFieldWeaponInfo, error) {
	utils.Log.Info("Frontend requested: GetWeaponData", zap.String("server", serverType))
	targetToken := a.getTokenByServerType(serverType)
	if targetToken == "" {
		utils.Log.Warn("Operation aborted: Token missing", zap.String("server", serverType))
		return nil, fmt.Errorf("未找到 %s 的 Token，请尝试先点击刷新 Token", serverType)
	}
	// 联网请求数据
	newData, err := utils.GetEndFieldWeaponDataAll(targetToken)
	if err != nil {
		utils.Log.Error("Network request failed", zap.String("server", serverType), zap.Error(err))
		return nil, fmt.Errorf("数据请求失败: %v", err)
	}
	utils.Log.Info("Network data received", zap.Int("count", len(newData)))
	// 合并并保存到本地 JSON
	mergedData, err := utils.MergeAndSaveWeaponData(newData, serverType)
	if err != nil {
		utils.Log.Warn("Failed to save data to JSON", zap.Error(err))
		return newData, nil
	}
	utils.Log.Info("Process complete: Data merged and saved", zap.Int("total_records", len(mergedData)))
	return mergedData, nil
}

// 辅助方法：根据 serverType 选择 Token
func (a *App) getTokenByServerType(serverType string) string {
	if serverType == "bilibili" {
		return GlobalTokens.Bilibili
	}
	return GlobalTokens.Official
}

// LocalDataResponse 离线模式数据结构
type LocalDataResponse struct {
	CharJson   string `json:"char"`
	WeaponJson string `json:"weapon"`
}

// LocalFileStatus 返回给前端，告知本地有哪些文件
type LocalFileStatus struct {
	HasOfficial bool `json:"hasOfficial"`
	HasBilibili bool `json:"hasBilibili"`
}

// CheckLocalFiles 检查本地是否存在对应服务器的数据文件
func (a *App) CheckLocalFiles() LocalFileStatus {
	return LocalFileStatus{
		HasOfficial: utils.CheckFilesExist("official"),
		HasBilibili: utils.CheckFilesExist("bilibili"),
	}
}

// LoadLocalGachaHistory 纯离线模式，只读取本地 JSON 数据返回给前端
func (a *App) LoadLocalGachaHistory(serverType string) (LocalDataResponse, error) {
	utils.Log.Info("Frontend requested: LoadLocalGachaHistory", zap.String("server", serverType))
	charList, weaponList, err := utils.ReadLocalData(serverType)
	if err != nil {
		utils.Log.Error("Failed to read local history", zap.Error(err))
		return LocalDataResponse{}, err
	}
	utils.Log.Info("Local history loaded",
		zap.Int("char_count", len(charList)),
		zap.Int("weapon_count", len(weaponList)),
	)
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

// 角色池分组逻辑
func groupByCharPoolName(data []utils.EndFieldCharInfo) map[string][]utils.EndFieldCharInfo {
	groupedData := make(map[string][]utils.EndFieldCharInfo)
	for _, item := range data {
		key := item.PoolName
		groupedData[key] = append(groupedData[key], item)
	}
	return groupedData
}

// 武器池分组逻辑
func groupByWeaponPoolName(data []utils.EndFieldWeaponInfo) map[string][]utils.EndFieldWeaponInfo {
	groupedData := make(map[string][]utils.EndFieldWeaponInfo)
	for _, item := range data {
		key := item.PoolName
		groupedData[key] = append(groupedData[key], item)
	}
	return groupedData
}

// ---------------------------------------------------------
// 以下为系统托盘(Systray)相关代码
// ---------------------------------------------------------

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

// AppSystray App系统托盘
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
	systray.SetOnRClick(func(menu systray.IMenu) {
		menu.ShowMenu()
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

	quitMenu := systray.AddMenuItem("Quit", "Quit the gacha app")
	quitMenu.SetIcon(quitIcon)
	quitMenu.Click(func() {
		a.onExit()
	})
}

func (a *App) onExit() {
	systray.Quit()
	wailsRuntime.Quit(a.ctx)
}
