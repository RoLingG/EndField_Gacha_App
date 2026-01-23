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

// EndFieldGachaResponse 定义终末地抽卡响应的结构
type EndFieldGachaResponse struct {
	Code int               `json:"code"`
	Data EndFieldGachaData `json:"data"`
	Msg  string            `json:"msg"`
}

// EndFieldGachaData 定义响应中的数据部分
type EndFieldGachaData struct {
	List    []EndFieldCharInfo `json:"list"`
	HasMore bool               `json:"hasMore"`
}

// EndFieldCharInfo 定义终末地角色信息的结构
// 直接作为最终数据结构提供给前端
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

// GetEndFieldGachaURLFromLog 从HGWebview.log文件中解析WebPortal URL
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
		return "", fmt.Errorf("未在HGWebview.log中找到有效的WebPortal URL")
	}
	return matches, nil
}

// GetEndFieldGachaData 获取单个卡池的数据
func GetEndFieldGachaData(pageURL string, targetPoolType string) ([]EndFieldCharInfo, error) {
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

// GetEndFieldGachaDataFromPools 遍历所有卡池
func GetEndFieldGachaDataFromPools() ([]EndFieldCharInfo, error) {
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
		data, err := GetEndFieldGachaData(baseURL, poolType)
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
