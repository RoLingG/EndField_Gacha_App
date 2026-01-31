// endfield_gacha.go
package utils

import (
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// EndFieldGachaResponse 定义终末地角色池抽卡响应结构
type EndFieldGachaResponse struct {
	Code int              `json:"code"`
	Data EndFieldCharData `json:"data"`
	Msg  string           `json:"msg"`
}

// EndFieldWeaponResponse 定义终末地武器池通用响应接口
type EndFieldWeaponResponse struct {
	Code int                `json:"code"`
	Data EndFieldWeaponData `json:"data"`
	Msg  string             `json:"msg"`
}

// EndFieldCharData 定义响应中的角色抽卡数据部分
type EndFieldCharData struct {
	List    []EndFieldCharInfo `json:"list"`
	HasMore bool               `json:"hasMore"`
}

// EndFieldWeaponData 武器记录的分页数据
type EndFieldWeaponData struct {
	List    []EndFieldWeaponInfo `json:"list"`
	HasMore bool                 `json:"hasMore"`
}

// EndFieldCharInfo 定义终末地角色信息的结构
type EndFieldCharInfo struct {
	CharID   string `json:"charId"`
	CharName string `json:"charName"`
	GachaTs  string `json:"gachaTs"`
	IsFree   bool   `json:"isFree"`
	IsNew    bool   `json:"isNew"`
	PoolID   string `json:"poolId"`
	PoolName string `json:"poolName"`
	Rarity   int    `json:"rarity"`
	SeqID    string `json:"seqId"`
}

// EndFieldWeaponInfo 定义终末地武器信息的结构
type EndFieldWeaponInfo struct {
	PoolID     string `json:"poolId"`
	PoolName   string `json:"poolName"`
	WeaponID   string `json:"weaponId"`
	WeaponName string `json:"weaponName"`
	WeaponType string `json:"weaponType"`
	Rarity     int    `json:"rarity"`
	IsNew      bool   `json:"isNew"`
	GachaTs    string `json:"gachaTs"`
	SeqID      string `json:"seqId"`
}

/*** 角色池没有下面这两玩意，官方直接写死了卡池列表，他们选择直接用卡池类型来直接获取数据 ***/

// EndFieldWeaponPoolResponse 定义武器卡池列表 API 的响应
type EndFieldWeaponPoolResponse struct {
	Code int                  `json:"code"`
	Data []EndFieldWeaponPool `json:"data"`
	Msg  string               `json:"msg"`
}

// EndFieldWeaponPool 单个武器卡池信息
type EndFieldWeaponPool struct {
	PoolID   string `json:"poolId"`
	PoolName string `json:"poolName"`
}

// ServerTokens 用于返回解析出的双端 Token/URL
type ServerTokens struct {
	Official string // 官服
	Bilibili string // B服
}

// parseLogForTokens 通用日志解析逻辑
func parseLogForTokens() (ServerTokens, error) {
	result := ServerTokens{}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		Log.Error("Failed to get user home directory", zap.Error(err))
		return result, fmt.Errorf("无法获取用户目录: %v", err)
	}

	logPath := filepath.Join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")
	Log.Debug("Attempting to read log file", zap.String("path", logPath))
	contentBytes, err := ioutil.ReadFile(logPath)
	if err != nil {
		Log.Warn("Failed to read log file", zap.Error(err))
		return result, fmt.Errorf("读取日志失败: %v", err)
	}
	content := string(contentBytes)
	// 正则匹配，同时匹配 char 和 weapon 的 URL
	re := regexp.MustCompile(`https://ef-webview\.hypergryph\.com/page/gacha_(?:char|weapon)\?[^\s]+`)

	allMatches := re.FindAllString(content, -1)
	if len(allMatches) == 0 {
		Log.Warn("No gacha URLs found in log file")
		return result, fmt.Errorf("未在日志中找到有效的抽卡记录链接")
	}
	// 倒序遍历，获取最新的 Token
	for i := len(allMatches) - 1; i >= 0; i-- {
		uStr := allMatches[i]

		// 官服特征: channel=1
		if result.Official == "" && strings.Contains(uStr, "channel=1") {
			result.Official = uStr
		}
		// B服特征: channel=2
		if result.Bilibili == "" && strings.Contains(uStr, "channel=2") {
			result.Bilibili = uStr
		}
		// 只要两个位置都填满了，就可以结束扫描
		if result.Official != "" && result.Bilibili != "" {
			break
		}
	}
	if result.Official == "" && result.Bilibili == "" {
		Log.Warn("Tokens found but none matched expected channel IDs")
		return result, fmt.Errorf("日志中未找到有效的最新 Token")
	}
	Log.Info("Log parsing successful",
		zap.Bool("official", result.Official != ""),
		zap.Bool("bilibili", result.Bilibili != ""),
	)
	return result, nil
}

// GetGachaTokensFromLog 获取通用双端 Token
func GetGachaTokensFromLog() (ServerTokens, error) {
	return parseLogForTokens()
}

// GetEndFieldCharGachaData 获取单个角色卡池的数据
func GetEndFieldCharGachaData(pageURL string, targetPoolType string) ([]EndFieldCharInfo, error) {
	client := &http.Client{}
	allData := make([]EndFieldCharInfo, 0)
	var seqID = ""

	u, err := url.Parse(pageURL)
	if err != nil {
		return nil, fmt.Errorf("解析原始URL失败: %v", err)
	}
	originalQuery := u.Query()

	token := originalQuery.Get("u8_token")
	serverID := originalQuery.Get("server")
	if serverID == "" {
		serverID = "1" // 默认值
	}
	lang := originalQuery.Get("lang")
	const apiBaseURL = "https://ef-webview.hypergryph.com/api/record/char"
	Log.Debug("Starting API fetch loop", zap.String("pool_type", targetPoolType))
	for {
		apiParams := url.Values{}
		apiParams.Set("lang", lang)
		apiParams.Set("token", token)
		apiParams.Set("server_id", serverID)
		apiParams.Set("pool_type", targetPoolType)

		if seqID != "" {
			apiParams.Set("seq_id", seqID)
		}

		finalAPIUrl := apiBaseURL + "?" + apiParams.Encode()

		req, err := http.NewRequest("GET", finalAPIUrl, nil)
		if err != nil {
			Log.Error("Failed to create HTTP request", zap.Error(err))
			return nil, fmt.Errorf("创建请求失败: %v", err)
		}

		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("Referer", pageURL)

		resp, err := client.Do(req)
		if err != nil {
			Log.Error("HTTP transport error", zap.String("url", finalAPIUrl), zap.Error(err))
			return nil, fmt.Errorf("发送请求失败: %v", err)
		}

		body, err := ioutil.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			Log.Error("API returned non-200 status",
				zap.Int("status_code", resp.StatusCode),
				zap.String("pool_type", targetPoolType),
			)
			return nil, fmt.Errorf("请求失败，状态码: %d", resp.StatusCode)
		}

		var response EndFieldGachaResponse
		err = json.Unmarshal(body, &response)
		if err != nil {
			Log.Error("Failed to parse API JSON response", zap.Error(err))
			return nil, fmt.Errorf("解析JSON失败: %v", err)
		}

		if response.Code != 0 {
			Log.Warn("API business logic error",
				zap.Int("code", response.Code),
				zap.String("msg", response.Msg),
			)
			return nil, fmt.Errorf("API返回错误: %s", response.Msg)
		}

		Log.Debug("Page fetched",
			zap.Int("count", len(response.Data.List)),
			zap.Bool("has_more", response.Data.HasMore),
		)
		allData = append(allData, response.Data.List...)

		if len(response.Data.List) > 0 {
			lastItem := response.Data.List[len(response.Data.List)-1]
			seqID = lastItem.SeqID
		}

		if !response.Data.HasMore {
			break
		}
	}
	return allData, nil
}

// GetEndFieldCharGachaDataAll 遍历所有卡池
func GetEndFieldCharGachaDataAll(baseURL string) ([]EndFieldCharInfo, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("传入的 URL 为空，无法获取角色数据")
	}
	poolTypes := []string{
		"E_CharacterGachaPoolType_Special",
		"E_CharacterGachaPoolType_Standard",
		"E_CharacterGachaPoolType_Beginner",
	}

	allData := make([]EndFieldCharInfo, 0)

	for _, poolType := range poolTypes {
		data, err := GetEndFieldCharGachaData(baseURL, poolType)
		if err != nil {
			Log.Warn("Failed to fetch specific pool",
				zap.String("pool_type", poolType),
				zap.Error(err),
			)
			continue
		}
		allData = append(allData, data...)
	}

	if len(allData) == 0 {
		return nil, fmt.Errorf("未获取到数据")
	}

	return allData, nil
}

// GetEndFieldWeaponPools 获取当前账号参与过的武器卡池列表
func GetEndFieldWeaponPools(pageURL string) ([]EndFieldWeaponPool, error) {
	u, err := url.Parse(pageURL)
	if err != nil {
		return nil, fmt.Errorf("解析URL失败: %v", err)
	}
	originalQuery := u.Query()
	token := originalQuery.Get("u8_token")
	serverID := originalQuery.Get("server")
	if serverID == "" {
		serverID = "1" // 默认值
	}
	apiURL := "https://ef-webview.hypergryph.com/api/record/weapon/pool"
	params := url.Values{}
	params.Set("lang", "zh-cn")
	params.Set("token", token)
	params.Set("server_id", serverID)
	req, err := http.NewRequest("GET", apiURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", pageURL)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var poolResp EndFieldWeaponPoolResponse
	if err := json.Unmarshal(body, &poolResp); err != nil {
		return nil, err
	}
	if poolResp.Code != 0 {
		return nil, fmt.Errorf("获取武器卡池列表失败: %s", poolResp.Msg)
	}
	return poolResp.Data, nil
}

// GetEndFieldWeaponDataByPool 获取单个武器池的具体记录
func GetEndFieldWeaponDataByPool(pageURL string, poolID string) ([]EndFieldWeaponInfo, error) {
	client := &http.Client{}
	allData := make([]EndFieldWeaponInfo, 0)
	var seqID = ""
	u, err := url.Parse(pageURL)
	if err != nil {
		return nil, fmt.Errorf("解析URL失败: %v", err)
	}
	originalQuery := u.Query()
	token := originalQuery.Get("u8_token")

	serverID := originalQuery.Get("server")
	if serverID == "" {
		serverID = "1" // 默认值
	}
	const apiBaseURL = "https://ef-webview.hypergryph.com/api/record/weapon"
	for {
		apiParams := url.Values{}
		apiParams.Set("lang", "zh-cn")
		apiParams.Set("token", token)
		apiParams.Set("server_id", serverID)
		apiParams.Set("pool_id", poolID)
		if seqID != "" {
			apiParams.Set("seq_id", seqID)
		}
		finalAPIUrl := apiBaseURL + "?" + apiParams.Encode()
		req, err := http.NewRequest("GET", finalAPIUrl, nil)
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %v", err)
		}
		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("Referer", pageURL)
		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("发送请求失败: %v", err)
		}
		body, err := ioutil.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("请求失败，状态码: %d", resp.StatusCode)
		}
		var response EndFieldWeaponResponse
		err = json.Unmarshal(body, &response)
		if err != nil {
			return nil, fmt.Errorf("解析JSON失败: %v", err)
		}
		if response.Code != 0 {
			return nil, fmt.Errorf("API返回错误: %s", response.Msg)
		}
		allData = append(allData, response.Data.List...)
		// 更新分页游标
		if len(response.Data.List) > 0 {
			lastItem := response.Data.List[len(response.Data.List)-1]
			seqID = lastItem.SeqID
		}
		if !response.Data.HasMore {
			break
		}
	}
	return allData, nil
}

func GetEndFieldWeaponDataAll(baseURL string) ([]EndFieldWeaponInfo, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("传入的 URL 为空，无法获取武器数据")
	}
	pools, err := GetEndFieldWeaponPools(baseURL)
	if err != nil {
		return nil, fmt.Errorf("获取武器池列表失败: %v", err)
	}
	allData := make([]EndFieldWeaponInfo, 0)
	for _, pool := range pools {
		poolData, err := GetEndFieldWeaponDataByPool(baseURL, pool.PoolID)
		if err != nil {
			return nil, fmt.Errorf("获取武器池 %v 数据失败: %v", pool.PoolName, err)
		}
		allData = append(allData, poolData...)
	}
	if len(allData) == 0 {
		return nil, fmt.Errorf("未找到任何武器池数据")
	}
	return allData, nil
}
