package storage

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go.uber.org/zap"
)

const DataDirectoryName = "userdata"

func GetStorageDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	exeDir := filepath.Dir(exePath)
	dataDir := filepath.Join(exeDir, DataDirectoryName)
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		if err := os.Mkdir(dataDir, 0755); err != nil {
			return "", err
		}
	}
	return dataDir, nil
}

// cleanTempFiles 清理目录中的 .tmp 文件
func cleanTempFiles(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".tmp" {
			tmpPath := filepath.Join(dir, entry.Name())
			os.Remove(tmpPath)
			logger.Log.Info("Cleaned temp file", zap.String("file", tmpPath))
		}
	}
}

// GetProfileDir 获取 UID 对应的存档目录
func GetProfileDir(uid string) (string, error) {
	baseDir, err := GetStorageDir()
	if err != nil {
		return "", err
	}
	if uid == "" {
		logger.Log.Error("UID is empty, cannot get profile directory")
		return "", fmt.Errorf("UID 不能为空")
	}
	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return "", fmt.Errorf("扫描 userdata 失败: %w", err)
	}
	// 遍历目录，寻找 uid 对应的文件夹
	for _, entry := range entries {
		if entry.IsDir() {
			name := entry.Name()
			if strings.HasPrefix(name, uid+"_") {
				// 找到目录
				targetDir := filepath.Join(baseDir, name)
				cleanTempFiles(targetDir)
				return targetDir, nil
			}
		}
	}
	// 未找到目录，则创建目录
	timeStr := time.Now().Format("2006-01-02_15-04-05")
	newDirName := fmt.Sprintf("%s_%s", uid, timeStr)
	finalPath := filepath.Join(baseDir, newDirName)
	if err := os.Mkdir(finalPath, 0755); err != nil {
		return "", fmt.Errorf("创建存档目录失败: %w", err)
	}
	return finalPath, nil
}

// getFilePath 内部辅助函数
func getFilePath(uid, serverType, category string) (string, error) {
	dir, err := GetProfileDir(uid)
	if err != nil {
		return "", err
	}
	prefix := model.ServerOfficial
	if serverType == model.ServerBilibili {
		prefix = model.ServerBilibili
	}
	// e.g. official_char_history.json
	filename := fmt.Sprintf("%s_%s_history.json", prefix, category)
	return filepath.Join(dir, filename), nil
}

// MergeAndSaveData 读取 -> 合并 -> 去重 -> 排序 -> 保存
func MergeAndSaveData[T model.GachaItem](newData []T, uid, serverType, category string) ([]T, error) {
	filePath, err := getFilePath(uid, serverType, category)
	if err != nil {
		return nil, err
	}

	// 读取旧数据
	var localData []T
	fileContent, err := os.ReadFile(filePath)
	if err == nil {
		if jsonErr := json.Unmarshal(fileContent, &localData); jsonErr != nil {
			logger.Log.Error("Local file corrupted, overwriting", zap.String("file", filePath))
		}
	}

	// 去重 (使用 Map, Key = SeqID)
	expectedSize := len(localData) + len(newData)
	dataMap := make(map[string]T, expectedSize)
	for _, item := range localData {
		dataMap[item.GetSeqID()] = item
	}
	for _, item := range newData {
		dataMap[item.GetSeqID()] = item
	}

	// 转回切片
	mergedList := make([]T, 0, len(dataMap))
	for _, item := range dataMap {
		mergedList = append(mergedList, item)
	}

	// 排序 (按时间倒序，如果时间相同按SeqID倒序)
	sort.Slice(mergedList, func(i, j int) bool {
		if mergedList[i].GetGachaTime() == mergedList[j].GetGachaTime() {
			return mergedList[i].GetSeqID() > mergedList[j].GetSeqID()
		}
		return mergedList[i].GetGachaTime() > mergedList[j].GetGachaTime()
	})

	// 保存
	outputData, err := json.MarshalIndent(mergedList, "", "  ")
	if err != nil {
		return nil, err
	}

	// 写入临时文件
	tempFile := filePath + ".tmp"
	if err := os.WriteFile(tempFile, outputData, 0644); err != nil {
		logger.Log.Error("Failed to write temp file", zap.Error(err))
		return mergedList, fmt.Errorf("写入临时文件失败: %v", err)
	}

	// 备份旧文件（如果存在）
	if _, err := os.Stat(filePath); err == nil {
		backupFile := filePath + ".bak"
		if err := os.Rename(filePath, backupFile); err != nil {
			// 备份失败，删除临时文件
			os.Remove(tempFile)
			logger.Log.Error("Failed to backup old file", zap.Error(err))
			return mergedList, fmt.Errorf("备份旧文件失败: %v", err)
		}
	}

	// 重命名临时文件为正式文件
	if err := os.Rename(tempFile, filePath); err != nil {
		// 重命名失败，尝试恢复备份
		backupFile := filePath + ".bak"
		if _, statErr := os.Stat(backupFile); statErr == nil {
			os.Rename(backupFile, filePath)
			logger.Log.Warn("Restored from backup", zap.String("file", filePath))
		}
		logger.Log.Error("Failed to save file", zap.Error(err))
		return mergedList, fmt.Errorf("保存文件失败: %v", err)
	}
	// 保存成功后删除备份文件
	backupFile := filePath + ".bak"
	if _, err := os.Stat(backupFile); err == nil {
		os.Remove(backupFile)
	}
	logger.Log.Info("Data saved successfully",
		zap.String("category", category),
		zap.String("uid", uid),
		zap.Int("count", len(mergedList)))

	return mergedList, nil
}

// ReadData 读取指定文件数据
func ReadData[T any](uid, serverType, category string) ([]T, error) {
	filePath, err := getFilePath(uid, serverType, category)
	if err != nil {
		return nil, err
	}
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	var list []T
	if err := json.Unmarshal(content, &list); err != nil {
		return nil, err
	}
	return list, nil
}
