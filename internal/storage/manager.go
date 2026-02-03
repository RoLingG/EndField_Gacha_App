package storage

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"sort"
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

// GetProfileDir 获取 UID 或 Local 文件夹
func GetProfileDir(uid string) (string, error) {
	baseDir, err := GetStorageDir()
	if err != nil {
		return "", err
	}
	dirName := "local"
	if uid != "" {
		dirName = uid
	}
	profileDir := filepath.Join(baseDir, dirName)
	if _, err := os.Stat(profileDir); os.IsNotExist(err) {
		if err := os.Mkdir(profileDir, 0755); err != nil {
			return "", err
		}
	}
	return profileDir, nil
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
			logger.Log.Warn("Local file corrupted, overwriting", zap.String("file", filePath))
		}
	}

	// 去重 (使用 Map, Key = SeqID)
	dataMap := make(map[string]T)
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
	if err := os.WriteFile(filePath, outputData, 0644); err != nil {
		logger.Log.Error("Failed to write file", zap.Error(err))
		return mergedList, err
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
