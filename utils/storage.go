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

// GetProfileDir 获取指定 UID 的数据目录
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

// getHistoryFilePath 根据 UID 和服务器类型生成文件路径
func getHistoryFilePath(uid string, serverType string, category string) (string, error) {
	// 如果 UID 传空字符串，自动映射到 "local" 文件夹
	dir, err := GetProfileDir(uid)
	if err != nil {
		return "", err
	}
	prefix := "official"
	if serverType == "bilibili" {
		prefix = "bilibili"
	}
	// 生成类似: official_char_history.json
	filename := fmt.Sprintf("%s_%s_history.json", prefix, category)
	return filepath.Join(dir, filename), nil
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
func MergeAndSaveCharData(newData []EndFieldCharInfo, uid string, serverType string) ([]EndFieldCharInfo, error) {
	// 根据 serverType 获取对应的文件路径
	filePath, err := getHistoryFilePath(uid, serverType, "char")
	if err != nil {
		return nil, err
	}
	var localData []EndFieldCharInfo
	fileContent, err := os.ReadFile(filePath)
	if err == nil {
		if jsonError := json.Unmarshal(fileContent, &localData); jsonError != nil {
			Log.Warn("Local history file corrupted, starting fresh", zap.Error(jsonError))
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
		Log.Error("Failed to write history file", zap.Error(err))
		return mergedList, err
	}
	Log.Info("Character history saved", zap.String("uid", uid), zap.Int("count", len(mergedList)))
	return mergedList, nil
}

// MergeAndSaveWeaponData 合并新旧武器数据并保存 (基本逻辑与角色数据一致)
func MergeAndSaveWeaponData(newData []EndFieldWeaponInfo, uid string, serverType string) ([]EndFieldWeaponInfo, error) {
	// 根据 serverType 获取对应的文件路径
	filePath, err := getHistoryFilePath(uid, serverType, "weapon")
	if err != nil {
		return nil, err
	}
	var localData []EndFieldWeaponInfo
	fileContent, err := os.ReadFile(filePath)
	if err == nil {
		if jsonError := json.Unmarshal(fileContent, &localData); jsonError != nil {
			Log.Warn("Local weapon file corrupted", zap.Error(jsonError))
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
		Log.Error("Failed to write weapon file", zap.Error(err))
		return mergedList, err
	}

	Log.Info("Weapon history saved", zap.String("uid", uid), zap.Int("count", len(mergedList)))
	return mergedList, nil
}

// ReadLocalData 仅获取本地数据而不保存
func ReadLocalData(uid string, serverType string) ([]EndFieldCharInfo, []EndFieldWeaponInfo, error) {
	// 读取角色
	charPath, err := getHistoryFilePath(uid, serverType, "char")
	if err != nil {
		return nil, nil, err
	}
	var charList []EndFieldCharInfo
	if bytes, err := os.ReadFile(charPath); err == nil {
		if err := json.Unmarshal(bytes, &charList); err != nil {
			Log.Warn("Failed to unmarshal local char data", zap.Error(err))
		}
	}
	// 读取武器
	weaponPath, err := getHistoryFilePath(uid, serverType, "weapon")
	if err != nil {
		return nil, nil, err
	}
	var weaponList []EndFieldWeaponInfo
	if bytes, err := os.ReadFile(weaponPath); err == nil {
		if err := json.Unmarshal(bytes, &weaponList); err != nil {
			Log.Warn("Failed to unmarshal local weapon data", zap.Error(err))
		}
	}
	return charList, weaponList, nil
}

// CheckFilesExist 检查文件是否存在
func CheckFilesExist(uid string, serverType string) bool {
	// TODO： 有些问题，只查了角色池
	charPath, err := getHistoryFilePath(uid, serverType, "char")
	if err != nil {
		return false
	}
	if _, err := os.Stat(charPath); err == nil {
		return true
	}
	return false
}
