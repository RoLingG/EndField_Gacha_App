package main

import (
	"Go_Arknights_Gacha_App/utils"
	"embed"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"go.uber.org/zap"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Init logger
	utils.InitLogger()
	// When program exit, log will save on the disk
	defer utils.SyncLog()

	// Create an instance of the app structure
	app := NewApp()
	utils.Log.Info("Wails Application Starting...")

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "明日方舟终末地抽卡记录",
		Width:     1440,
		Height:    900,
		MinWidth:  1024,
		MinHeight: 768,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		utils.Log.Fatal("Error during application run", zap.Error(err))
	}
}
