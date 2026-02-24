package storage

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"os"
	"path/filepath"
)

const poolConfigFileName = "pool_config.json"
const discoveredPoolIDsFileName = "discovered_pool_ids.json"
const poolConfigDirName = "poolConfig"

// getPoolConfigDir 获取卡池配置目录，不存在则创建
func getPoolConfigDir() (string, error) {
	dataDir, err := GetStorageDir()
	if err != nil {
		return "", err
	}
	poolConfigDir := filepath.Join(dataDir, poolConfigDirName)
	if err := os.MkdirAll(poolConfigDir, 0755); err != nil {
		return "", fmt.Errorf("创建poolconfig目录失败: %v", err)
	}
	return poolConfigDir, nil
}

// DiscoveredPoolIDs 已发现的卡池ID列表
type DiscoveredPoolIDs struct {
	PoolIDs    []string `json:"poolIds"`
	LastUpdate string   `json:"lastUpdate"`
}

// SaveDiscoveredPoolIDs 保存发现的卡池ID
func SaveDiscoveredPoolIDs(poolIDs []string) error {
	// 先加载现有的
	existing, err := LoadDiscoveredPoolIDs()
	if err != nil {
		return fmt.Errorf("加载现有pool_id失败: %v", err)
	}

	// 构建现有 ID 集合
	existingSet := make(map[string]bool)
	for _, id := range existing.PoolIDs {
		existingSet[id] = true
	}

	// 追加不重复的 pool_id
	addedCount := 0
	for _, id := range poolIDs {
		if !existingSet[id] {
			existing.PoolIDs = append(existing.PoolIDs, id)
			existingSet[id] = true
			addedCount++
		}
	}

	if addedCount == 0 {
		return nil // 没有新增，不需要写入
	}

	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, discoveredPoolIDsFileName)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化失败: %v", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}

	logger.Log.Info("Discovered pool IDs saved",
		zap.Int("total", len(existing.PoolIDs)),
		zap.Int("new_added", addedCount))

	return nil
}

// LoadDiscoveredPoolIDs 加载已发现的卡池ID列表
func LoadDiscoveredPoolIDs() (*DiscoveredPoolIDs, error) {
	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return nil, fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, discoveredPoolIDsFileName)

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &DiscoveredPoolIDs{PoolIDs: []string{}}, nil
		}
		return nil, fmt.Errorf("读取文件失败: %v", err)
	}

	var result DiscoveredPoolIDs
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("解析文件失败: %v", err)
	}

	return &result, nil
}

// SavePoolConfig 保存卡池配置到文件（追加写入，自动去重）
func SavePoolConfig(configList model.PoolConfigList) error {
	// 先加载现有配置
	existing, err := LoadPoolConfig()
	if err != nil {
		return fmt.Errorf("加载现有配置失败: %v", err)
	}

	// 构建现有卡池名称的集合，用于快速查重
	existingPools := make(map[string]bool)
	for _, pool := range existing.Pools {
		existingPools[pool.PoolName] = true
	}

	// 追加不重复的新卡池
	addedCount := 0
	for _, newPool := range configList.Pools {
		if !existingPools[newPool.PoolName] {
			existing.Pools = append(existing.Pools, newPool)
			existingPools[newPool.PoolName] = true
			addedCount++
		}
	}

	// 更新时间戳
	if configList.LastUpdate != "" {
		existing.LastUpdate = configList.LastUpdate
	}

	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, poolConfigFileName)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %v", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("写入配置文件失败: %v", err)
	}

	logger.Log.Info("Pool config saved successfully",
		zap.String("path", configPath),
		zap.Int("total_pools", len(existing.Pools)),
		zap.Int("new_pools_added", addedCount))

	return nil
}

// LoadPoolConfig 加载卡池配置
func LoadPoolConfig() (*model.PoolConfigList, error) {
	poolConfigDir, err := getPoolConfigDir()
	if err != nil {
		return nil, fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(poolConfigDir, poolConfigFileName)

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &model.PoolConfigList{Pools: []model.PoolConfig{}}, nil
		}
		return nil, fmt.Errorf("读取配置文件失败: %v", err)
	}

	var configList model.PoolConfigList
	if err := json.Unmarshal(data, &configList); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %v", err)
	}

	return &configList, nil
}
