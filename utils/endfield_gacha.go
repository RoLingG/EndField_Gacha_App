package utils

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
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

// GetEndFieldGachaURLFromLog 从HGWebview.log文件中解析角色池WebPortal URL
func GetEndFieldGachaURLFromLog() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("无法获取用户目录: %v", err)
	}

	logPath := filepath.Join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")

	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return "", fmt.Errorf("HGWebview.log文件不存在: %s", logPath)
	}

	content, err := ioutil.ReadFile(logPath)
	if err != nil {
		return "", fmt.Errorf("读取HGWebview.log文件失败: %v", err)
	}

	re := regexp.MustCompile(`https://ef-webview\.hypergryph\.com/page/gacha_char\?[^\s]+`)
	matches := re.FindString(string(content))
	if matches == "" {
		return "", fmt.Errorf("未在HGWebview.log中找到有效的WebPortal URL, (gacha_char)，请在游戏中打开一次角色卡池历史记录")
	}
	return matches, nil
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
	if token == "" {
		token = originalQuery.Get("token")
	}
	serverID := originalQuery.Get("server")
	lang := originalQuery.Get("lang")

	const apiBaseURL = "https://ef-webview.hypergryph.com/api/record/char"

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

		var response EndFieldGachaResponse
		err = json.Unmarshal(body, &response)
		if err != nil {
			return nil, fmt.Errorf("解析JSON失败: %v", err)
		}

		if response.Code != 0 {
			return nil, fmt.Errorf("API返回错误: %s", response.Msg)
		}

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
func GetEndFieldCharGachaDataAll() ([]EndFieldCharInfo, error) {
	baseURL, err := GetEndFieldGachaURLFromLog()
	if err != nil {
		return nil, err
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
			fmt.Printf("获取卡池 %s 失败: %v\n", poolType, err)
			continue
		}
		allData = append(allData, data...)
	}

	if len(allData) == 0 {
		return nil, fmt.Errorf("未获取到数据")
	}

	return allData, nil
}

// GetEndFieldWeaponURLFromLog 从HGWebview.log文件中解析武器池WebPortal URL
func GetEndFieldWeaponURLFromLog() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("无法获取用户目录: %v", err)
	}

	logPath := filepath.Join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")

	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return "", fmt.Errorf("HGWebview.log文件不存在: %s", logPath)
	}

	content, err := ioutil.ReadFile(logPath)
	if err != nil {
		return "", fmt.Errorf("读取HGWebview.log文件失败: %v", err)
	}

	re := regexp.MustCompile(`https://ef-webview\.hypergryph\.com/page/gacha_weapon\?[^\s]+`)
	matches := re.FindString(string(content))
	if matches == "" {
		return "", fmt.Errorf("未在HGWebview.log中找到有效的WebPortal URL, (gacha_weapon)，请在游戏中打开一次武器卡池历史记录")
	}
	return matches, nil
}

// GetEndFieldWeaponPools 获取当前账号参与过的武器卡池列表
func GetEndFieldWeaponPools(pageURL string) ([]EndFieldWeaponPool, error) {
	u, err := url.Parse(pageURL)
	if err != nil {
		return nil, fmt.Errorf("解析URL失败: %v", err)
	}
	originalQuery := u.Query()
	token := originalQuery.Get("u8_token")

	// 根据 URL 获取 server 参数
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

func GetEndFieldWeaponDataAll() ([]EndFieldWeaponInfo, error) {
	baseURL, err := GetEndFieldWeaponURLFromLog()
	if err != nil {
		return nil, err
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
