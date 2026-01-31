// storage.go
package utils

import (
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"sort"
)

const (
	DataDirectoryName = "userdata"
)

// getHistoryFilePath 根据服务器类型生成文件路径
func getHistoryFilePath(dir string, serverType string, category string) string {
	prefix := "official"
	if serverType == "bilibili" {
		prefix = "bilibili"
	}
	// 生成类似: official_char_history.json
	filename := fmt.Sprintf("%s_%s_history.json", prefix, category)
	return filepath.Join(dir, filename)
}

func GetStorageDir() (string, error) {
	// 获取当前执行程序的路径
	exePath, err := os.Executable()
	if err != nil {
		Log.Error("Failed to get executable path", zap.Error(err))
		return "", err
	}
	// 获取该执行文件所在的目录 (例如 D:\GameTools\EndfieldGacha\)
	exeDir := filepath.Dir(exePath)
	// 拼接数据文件夹路径 (例如 D:\GameTools\EndfieldGacha\userdata)
	dataDir := filepath.Join(exeDir, DataDirectoryName)
	// 检查数据文件夹是否存在，如果不存在则创建
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		mkErr := os.Mkdir(dataDir, 0755)
		if mkErr != nil {
			Log.Fatal("Failed to create userdata directory",
				zap.String("path", dataDir),
				zap.Error(mkErr),
			)
			return "", mkErr
		}
	}
	return dataDir, nil
}

// MergeAndSaveCharData 合并新旧角色数据并保存
func MergeAndSaveCharData(newData []EndFieldCharInfo, serverType string) ([]EndFieldCharInfo, error) {
	dir, err := GetStorageDir()
	if err != nil {
		return nil, err
	}

	// 根据 serverType 获取对应的文件路径
	filePath := getHistoryFilePath(dir, serverType, "char")
	Log.Debug("Processing character archive", zap.String("file", filePath))
	var localData []EndFieldCharInfo
	fileContent, err := os.ReadFile(filePath)
	if err == nil {
		if jsonError := json.Unmarshal(fileContent, &localData); jsonError != nil {
			Log.Warn("Local history file corrupted, starting fresh",
				zap.String("file", filePath),
				zap.Error(jsonError),
			)
		} else {
			Log.Debug("Loaded existing records", zap.Int("count", len(localData)))
		}
	}
	// Map 去重 (Key = SeqID)
	dataMap := make(map[string]EndFieldCharInfo)
	for _, item := range localData {
		dataMap[item.SeqID] = item
	}
	for _, item := range newData {
		dataMap[item.SeqID] = item
	}
	var mergedList []EndFieldCharInfo
	for _, item := range dataMap {
		mergedList = append(mergedList, item)
	}
	// 排序
	sort.Slice(mergedList, func(i, j int) bool {
		if mergedList[i].GachaTs == mergedList[j].GachaTs {
			return mergedList[i].SeqID > mergedList[j].SeqID
		}
		return mergedList[i].GachaTs > mergedList[j].GachaTs
	})
	outputData, err := json.MarshalIndent(mergedList, "", "  ")
	if err != nil {
		Log.Error("Failed to marshal JSON data", zap.Error(err))
		return nil, err
	}

	// 写入对应的文件
	err = os.WriteFile(filePath, outputData, 0644)
	if err != nil {
		Log.Error("Failed to write history file",
			zap.String("file", filePath),
			zap.Error(err),
		)
		return mergedList, err
	}
	Log.Info("Character history saved successfully", zap.Int("total_records", len(mergedList)))
	return mergedList, nil
}

// MergeAndSaveWeaponData 合并新旧武器数据并保存 (基本逻辑与角色数据一致)
func MergeAndSaveWeaponData(newData []EndFieldWeaponInfo, serverType string) ([]EndFieldWeaponInfo, error) {
	dir, err := GetStorageDir()
	if err != nil {
		return nil, err
	}
	// 根据 serverType 获取对应的文件路径
	filePath := getHistoryFilePath(dir, serverType, "weapon")
	Log.Debug("Processing weapon archive", zap.String("file", filePath))
	var localData []EndFieldWeaponInfo
	fileContent, err := os.ReadFile(filePath)
	if err == nil {
		if jsonError := json.Unmarshal(fileContent, &localData); jsonError != nil {
			Log.Warn("Local weapon file corrupted",
				zap.String("file", filePath),
				zap.Error(jsonError),
			)
		}
	}
	dataMap := make(map[string]EndFieldWeaponInfo)
	for _, item := range localData {
		dataMap[item.SeqID] = item
	}
	for _, item := range newData {
		dataMap[item.SeqID] = item
	}
	var mergedList []EndFieldWeaponInfo
	for _, item := range dataMap {
		mergedList = append(mergedList, item)
	}
	sort.Slice(mergedList, func(i, j int) bool {
		if mergedList[i].GachaTs == mergedList[j].GachaTs {
			return mergedList[i].SeqID > mergedList[j].SeqID
		}
		return mergedList[i].GachaTs > mergedList[j].GachaTs
	})
	outputData, err := json.MarshalIndent(mergedList, "", "  ")
	if err != nil {
		Log.Error("Failed to marshal JSON", zap.Error(err))
		return nil, err
	}

	err = os.WriteFile(filePath, outputData, 0644)
	if err != nil {
		Log.Error("Failed to write weapon file", zap.String("file", filePath), zap.Error(err))
		return mergedList, err
	}

	Log.Info("Weapon history saved successfully", zap.Int("total_records", len(mergedList)))
	return mergedList, nil
}

// ReadLocalData 仅获取本地数据而不保存
func ReadLocalData(serverType string) ([]EndFieldCharInfo, []EndFieldWeaponInfo, error) {
	dir, err := GetStorageDir()
	if err != nil {
		return nil, nil, err
	}
	// 读取角色
	charPath := getHistoryFilePath(dir, serverType, "char")
	var charList []EndFieldCharInfo
	if bytes, err := os.ReadFile(charPath); err == nil {
		if err := json.Unmarshal(bytes, &charList); err != nil {
			Log.Warn("Failed to unmarshal local char data", zap.Error(err))
		}
	} else {
		Log.Debug("No local char history found", zap.String("path", charPath))
	}
	// 读取武器
	weaponPath := getHistoryFilePath(dir, serverType, "weapon")
	var weaponList []EndFieldWeaponInfo
	if bytes, err := os.ReadFile(weaponPath); err == nil {
		if err := json.Unmarshal(bytes, &weaponList); err != nil {
			Log.Warn("Failed to unmarshal local weapon data", zap.Error(err))
		}
	} else {
		Log.Debug("No local weapon history found", zap.String("path", weaponPath))
	}
	return charList, weaponList, nil
}

// CheckFilesExist 检查文件是否存在
func CheckFilesExist(serverType string) bool {
	dir, _ := GetStorageDir()
	charPath := getHistoryFilePath(dir, serverType, "char")
	if _, err := os.Stat(charPath); err == nil {
		return true
	}
	return false
}
