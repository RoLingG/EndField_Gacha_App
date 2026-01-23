package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"log"

	"git.sr.ht/~jackmordaunt/go-toast"
	"github.com/energye/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"Go_Arknights_Gacha_App/utils"
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
	runtime.WindowReload(a.ctx)
}

func (a *App) WindowMinSize() {
	runtime.WindowMinimise(a.ctx)
}

func (a *App) WindowToggleMaxSize() bool {
	isMax := runtime.WindowIsMaximised(a.ctx)
	if isMax {
		runtime.WindowUnmaximise(a.ctx)
	} else {
		runtime.WindowMaximise(a.ctx)
	}
	return isMax
}

func (a *App) WindowClose() {
	runtime.Quit(a.ctx)
}

// groupByPoolName 将原数据按卡池分组
func groupByPoolName(data []utils.EndFieldCharInfo) map[string][]utils.EndFieldCharInfo {
	groupedData := make(map[string][]utils.EndFieldCharInfo)
	for _, item := range data {
		key := item.PoolName
		groupedData[key] = append(groupedData[key], item)
	}
	return groupedData
}

// RefreshGachaHistory 导出给前端调用的核心方法
func (a *App) RefreshGachaHistory() (string, error) {
	// 1. 获取终末地原生数据
	endFieldData, err := utils.GetEndFieldGachaDataFromPools()
	if err != nil {
		log.Println("Failed to retrieve EndField gacha data:", err)
		return "", err
	}

	// 2. 移除旧的 convert 步骤，直接按池子分组
	// 注意：EndFieldCharInfo 的 JSON tag 已经与前端需求兼容
	// 前端不再需要 Pos 字段，或者可以在前端 JS 中通过 index 计算
	grouped := groupByPoolName(endFieldData)

	// 3. 序列化为 JSON
	jsonData, err := json.MarshalIndent(grouped, "", "  ")
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
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
		runtime.Show(a.ctx)
	})
	systray.SetOnRClick(func(menu systray.IMenu) {
		menu.ShowMenu()
	})

	showMenu := systray.AddMenuItem("显示", "Show the gacha app")
	showMenu.SetIcon(showIcon)
	showMenu.Click(func() {
		go runtime.Show(a.ctx)
	})

	hideMenu := systray.AddMenuItem("隐藏", "Hide the gacha app")
	hideMenu.SetIcon(hideIcon)
	hideMenu.Click(func() {
		go runtime.Hide(a.ctx)
	})

	reloadMenu := systray.AddMenuItem("重置", "Reload the gacha app")
	reloadMenu.SetIcon(reloadIcon)
	reloadMenu.Click(func() {
		go a.ReloadFrontend()
		go a.notify("EndField Gacha History消息", "已重置App内容")
	})

	quitMenu := systray.AddMenuItem("Quit", "Quit the gacha app")
	quitMenu.SetIcon(quitIcon)
	quitMenu.Click(func() {
		a.onExit()
	})
}

func (a *App) onExit() {
	systray.Quit()
	runtime.Quit(a.ctx)
}

// 系统桌面消息提示
func (a *App) notify(str string, msg string) {
	// 这里的路径建议以后改为相对路径或配置项，暂时保持原样
	notification := toast.Notification{
		AppID: "EndField_Gacha_History",
		Title: str,
		Body:  msg,
		Icon:  "D:\\GoLand\\EndField_App\\frontend\\src\\assets\\icons\\home.ico",
		Actions: []toast.Action{
			{
				Type:      "protocol",
				Content:   "查看详情",
				Arguments: "https://rolingg.top",
			},
		},
		Audio: toast.Default,
	}
	err := notification.Push()
	if err != nil {
		log.Println("Notification error:", err)
	}
}
