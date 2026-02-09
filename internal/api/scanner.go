package api

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"Go_Arknights_Gacha_App/internal/storage"
	"fmt"
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"regexp"
	"sort"
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

// ScanLocalArchives 扫描 userdata 下所有有效的数据目录
func ScanLocalArchives() ([]model.LocalArchive, error) {
	baseDir, err := storage.GetStorageDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return nil, err
	}
	var archives []model.LocalArchive
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dirName := entry.Name()
		fullPath := filepath.Join(baseDir, dirName)
		// 检查该目录下有哪些服的数据
		var servers []string
		if _, err := os.Stat(filepath.Join(fullPath, "official_char_history.json")); err == nil {
			servers = append(servers, model.ServerOfficial)
		} else if _, err := os.Stat(filepath.Join(fullPath, "official_weapon_history.json")); err == nil {
			servers = append(servers, model.ServerOfficial)
		}
		if _, err := os.Stat(filepath.Join(fullPath, "bilibili_char_history.json")); err == nil {
			servers = append(servers, model.ServerBilibili)
		} else if _, err := os.Stat(filepath.Join(fullPath, "bilibili_weapon_history.json")); err == nil {
			servers = append(servers, model.ServerBilibili)
		}
		// 如果没有任何数据文件则跳过
		if len(servers) == 0 {
			continue
		}
		var uid, ts string
		parts := strings.SplitN(dirName, "_", 2)
		if len(parts) == 2 {
			uid = parts[0]
			ts = parts[1]
		} else {
			uid = dirName
			ts = "unknown"
		}
		archives = append(archives, model.LocalArchive{
			Uid:       uid,
			Timestamp: ts,
			Path:      fullPath,
			Servers:   servers,
		})
	}
	sort.Slice(archives, func(i, j int) bool {
		return archives[i].Timestamp > archives[j].Timestamp
	})
	return archives, nil
}
