package api

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"Go_Arknights_Gacha_App/internal/retry"
	"bytes"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"io"
	"net/http"
	"net/url"
)

const (
	BaseUrlChar       = "https://ef-webview.hypergryph.com/api/record/char"
	BaseUrlWeapon     = "https://ef-webview.hypergryph.com/api/record/weapon"
	BaseUrlWeaponPool = "https://ef-webview.hypergryph.com/api/record/weapon/pool"
	AppCodeEndfield   = "endfield"
	AppCodeLogin      = "be36d44aa36bfb5b"
)

// gachaSession 通用上下文信息
type gachaSession struct {
	Token    string
	ServerID string
	Lang     string
}

// get 发起 GET 请求，自动处理 Referer 和通用参数
func (s *gachaSession) get(targetURL string, queryParams url.Values, refererPage string) ([]byte, error) {
	reqUrl := targetURL
	if len(queryParams) > 0 {
		reqUrl = targetURL + "?" + queryParams.Encode()
	}
	req, err := http.NewRequest("GET", reqUrl, nil)
	if err != nil {
		return nil, err
	}
	// 自动构造 Referer
	refParams := url.Values{}
	refParams.Set("u8_token", s.Token)
	refParams.Set("server", s.ServerID)
	refParams.Set("lang", s.Lang)
	req.Header.Set("Referer", fmt.Sprintf("https://ef-webview.hypergryph.com/page/%s?%s", refererPage, refParams.Encode()))
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP Status: %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// FetchCharDataAll 获取所有角色池数据
func FetchCharDataAll(token, serverID, lang string) ([]model.EndFieldCharInfo, error) {
	if token == "" {
		return nil, fmt.Errorf("token invalid")
	}
	// 初始化会话上下文
	sess := &gachaSession{Token: token, ServerID: serverID, Lang: lang}
	poolTypes := []string{
		"E_CharacterGachaPoolType_Special",
		"E_CharacterGachaPoolType_Standard",
		"E_CharacterGachaPoolType_Beginner",
	}
	type result struct {
		data []model.EndFieldCharInfo
		err  error
	}
	results := make(chan result, len(poolTypes))
	for _, pt := range poolTypes {
		go func(poolType string) {
			// 参数简化：直接传递 session 和 poolType
			data, err := fetchCharDataFromPool(sess, poolType)
			results <- result{data: data, err: err}
		}(pt)
	}
	var allData []model.EndFieldCharInfo
	successCount := 0
	for i := 0; i < len(poolTypes); i++ {
		res := <-results
		if res.err != nil {
			logger.Log.Warn("Failed to fetch pool", zap.Error(res.err))
			continue
		}
		allData = append(allData, res.data...)
		successCount++
	}
	if successCount == 0 {
		return nil, fmt.Errorf("未获取到任何角色数据")
	}
	return allData, nil
}

func fetchCharDataFromPool(sess *gachaSession, poolType string) ([]model.EndFieldCharInfo, error) {
	var list []model.EndFieldCharInfo
	seqID := ""
	for {
		var apiResp model.EndFieldGachaResponse
		err := retry.Do(func() error {
			params := url.Values{}
			params.Set("lang", sess.Lang)
			params.Set("token", sess.Token)
			params.Set("server_id", sess.ServerID)
			params.Set("pool_type", poolType)
			if seqID != "" {
				params.Set("seq_id", seqID)
			}
			// 调用封装后的 get 方法
			body, err := sess.get(BaseUrlChar, params, "gacha_char")
			if err != nil {
				return err
			}
			return json.Unmarshal(body, &apiResp)
		}, retry.DefaultConfig)
		if err != nil {
			return nil, fmt.Errorf("获取数据失败: %v", err)
		}
		if apiResp.Code != 0 {
			return nil, fmt.Errorf("API Error: %s", apiResp.Msg)
		}
		list = append(list, apiResp.Data.List...)
		if !apiResp.Data.HasMore || len(apiResp.Data.List) == 0 {
			break
		}
		seqID = apiResp.Data.List[len(apiResp.Data.List)-1].SeqID
	}
	return list, nil
}

// FetchWeaponDataAll 获取所有武器数据
func FetchWeaponDataAll(token, serverID, lang string) ([]model.EndFieldWeaponInfo, error) {
	if token == "" {
		return nil, fmt.Errorf("token 为空")
	}
	sess := &gachaSession{Token: token, ServerID: serverID, Lang: lang}
	// 1. 获取账号参与过的武器卡池列表
	pools, err := fetchWeaponPoolList(sess)
	if err != nil {
		return nil, fmt.Errorf("获取武器卡池列表失败: %v", err)
	}
	var allData []model.EndFieldWeaponInfo
	// 2. 遍历每个卡池获取详情
	for _, pool := range pools {
		poolData, err := fetchWeaponDataByPool(sess, pool.PoolID)
		if err != nil {
			logger.Log.Warn("Failed to fetch specific weapon pool",
				zap.String("pool_name", pool.PoolName),
				zap.Error(err))
			continue
		}
		allData = append(allData, poolData...)
	}
	if len(allData) == 0 {
		return nil, fmt.Errorf("未获取到任何武器数据")
	}
	return allData, nil
}

// fetchWeaponPoolList 获取卡池列表
func fetchWeaponPoolList(sess *gachaSession) ([]model.EndFieldWeaponPool, error) {
	var poolResp model.EndFieldWeaponPoolResponse

	err := retry.Do(func() error {
		params := url.Values{}
		params.Set("lang", sess.Lang)
		params.Set("token", sess.Token)
		params.Set("server_id", sess.ServerID)

		body, err := sess.get(BaseUrlWeaponPool, params, "gacha_weapon")
		if err != nil {
			return err
		}
		return json.Unmarshal(body, &poolResp)
	}, retry.DefaultConfig)
	if err != nil {
		return nil, err
	}
	if poolResp.Code != 0 {
		return nil, fmt.Errorf(poolResp.Msg)
	}
	return poolResp.Data, nil
}

// fetchWeaponDataByPool 获取特定卡池的抽卡记录
func fetchWeaponDataByPool(sess *gachaSession, poolID string) ([]model.EndFieldWeaponInfo, error) {
	var list []model.EndFieldWeaponInfo
	seqID := ""
	for {
		var apiResp model.EndFieldWeaponResponse
		err := retry.Do(func() error {
			params := url.Values{}
			params.Set("lang", sess.Lang)
			params.Set("token", sess.Token)
			params.Set("server_id", sess.ServerID)
			params.Set("pool_id", poolID)
			if seqID != "" {
				params.Set("seq_id", seqID)
			}

			body, err := sess.get(BaseUrlWeapon, params, "gacha_weapon")
			if err != nil {
				return err
			}
			return json.Unmarshal(body, &apiResp)
		}, retry.DefaultConfig)
		if err != nil {
			return nil, fmt.Errorf("获取武器池 %s 数据失败: %v", poolID, err)
		}
		if apiResp.Code != 0 {
			return nil, fmt.Errorf("API Error: %s", apiResp.Msg)
		}
		list = append(list, apiResp.Data.List...)
		if !apiResp.Data.HasMore || len(apiResp.Data.List) == 0 {
			break
		}
		seqID = apiResp.Data.List[len(apiResp.Data.List)-1].SeqID
	}
	return list, nil
}

// GetGrantToken 获取短 Token
func GetGrantToken(shortToken string) (string, error) {
	reqBody := model.GrantRequest{
		AppCode: AppCodeLogin,
		Token:   shortToken,
		Type:    1,
	}
	jsonBody, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", "https://as.hypergryph.com/user/oauth2/v2/grant", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Log.Error("Network error in Grant step", zap.Error(err))
		return "", fmt.Errorf("网络请求失败(Grant): %v", err)
	}
	defer resp.Body.Close()
	var result model.GrantResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析响应失败(Grant): %v", err)
	}
	if result.Status != 0 {
		logger.Log.Error("Grant API returned error", zap.Int("status", result.Status), zap.String("msg", result.Msg))
		return "", fmt.Errorf("登录授权失败: %s", result.Msg)
	}
	return result.Data.Token, nil
}

// GetPlayerBindings 获取账号下的角色绑定列表
func GetPlayerBindings(hgToken string) ([]model.PlayerBindingInfo, error) {
	params := url.Values{}
	params.Add("token", hgToken)
	params.Add("appCode", AppCodeEndfield)
	reqUrl := "https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list?" + params.Encode()

	req, err := http.NewRequest("GET", reqUrl, nil)
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("网络请求失败(Binding): %v", err)
	}
	defer resp.Body.Close()
	var result model.BindingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析响应失败(Binding): %v", err)
	}
	if result.Status != 0 {
		return nil, fmt.Errorf("获取绑定列表失败: %s", result.Msg)
	}
	var playerList []model.PlayerBindingInfo
	for _, app := range result.Data.List {
		if app.AppCode == AppCodeEndfield {
			for _, binding := range app.BindingList {
				nickName := "未知指挥官"
				level := 0
				if len(binding.Roles) > 0 {
					nickName = binding.Roles[0].NickName
					level = binding.Roles[0].Level
				}
				serverType := "unknown"
				if binding.IsOfficial {
					serverType = "official"
				} else {
					// 如果未来鹰角改了 ChannelName，可能需要更新
					if binding.ChannelName == "bilibili服" {
						serverType = "bilibili"
					}
				}
				playerList = append(playerList, model.PlayerBindingInfo{
					Uid:         binding.Uid,
					NickName:    nickName,
					Level:       level,
					ChannelName: binding.ChannelName,
					IsOfficial:  binding.IsOfficial,
					ServerType:  serverType,
				})
			}
		}
	}
	if len(playerList) == 0 {
		return nil, fmt.Errorf("该账号下未找到终末地的角色信息")
	}
	return playerList, nil
}

// GetU8Token 使用通行证 Token 换取游戏内 Webview Token
func GetU8Token(hgToken, hgUid string) (string, error) {
	reqBody := model.U8TokenRequest{
		Token: hgToken,
		Uid:   hgUid,
	}
	jsonBody, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", "https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("网络请求失败(U8Token): %v", err)
	}
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var result model.U8TokenResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return "", fmt.Errorf("解析响应失败(U8Token): %v", err)
	}
	if result.Status != 0 {
		logger.Log.Error("U8Token API error",
			zap.Int("status", result.Status),
			zap.String("msg", result.Msg),
		)
		return "", fmt.Errorf("获取游戏Token失败: %s", result.Msg)
	}
	return result.Data.Token, nil
}
