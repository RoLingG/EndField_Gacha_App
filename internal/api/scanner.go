package api

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"fmt"
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var tokenRegex = regexp.MustCompile(`https://ef-webview\.hypergryph\.com/page/gacha_(?:char|weapon)\?[^\s]+`)

// ScanLogForTokens 扫描本地日志获取 Token
func ScanLogForTokens() (model.ServerTokens, error) {
	result := model.ServerTokens{}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return result, err
	}

	logPath := filepath.Join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")
	contentBytes, err := os.ReadFile(logPath)
	if err != nil {
		logger.Log.Warn("Log file not found", zap.String("path", logPath))
		return result, fmt.Errorf("无法读取日志文件")
	}

	content := string(contentBytes)
	matches := tokenRegex.FindAllString(content, -1)

	if len(matches) == 0 {
		return result, fmt.Errorf("未在日志中找到 Token 链接")
	}

	// 倒序查找最新
	for i := len(matches) - 1; i >= 0; i-- {
		uStr := matches[i]
		if result.Official == "" && strings.Contains(uStr, "channel=1") {
			result.Official = uStr
		}
		if result.Bilibili == "" && strings.Contains(uStr, "channel=2") {
			result.Bilibili = uStr
		}
		if result.Official != "" && result.Bilibili != "" {
			break
		}
	}
	return result, nil
}
