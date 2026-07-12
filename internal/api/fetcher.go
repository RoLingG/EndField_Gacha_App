package api

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"Go_Arknights_Gacha_App/internal/retry"
	"Go_Arknights_Gacha_App/internal/storage"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"go.uber.org/zap"
)

const (
	BaseUrlChar        = "https://ef-webview.hypergryph.com/api/record/char"
	BaseUrlWeapon      = "https://ef-webview.hypergryph.com/api/record/weapon"
	BaseUrlWeaponPool  = "https://ef-webview.hypergryph.com/api/record/weapon/pool"
	BaseUrlPoolContent = "https://ef-webview.hypergryph.com/api/content"
	BaseUrlRoleQuery   = "https://u8.hypergryph.com/game/role/v1/query_role_list"
	AppCodeEndfield    = "endfield"
	AppCodeLogin       = "be36d44aa36bfb5b"
)

// gachaSession 通用上下文信息
type gachaSession struct {
	Token    string
	ServerID string
	Lang     string
}

// get 发起 GET 请求，自动处理 Referer 和通用参数
func (s *gachaSession) get(ctx context.Context, targetURL string, queryParams url.Values, refererPage string) ([]byte, error) {
	reqUrl := targetURL
	if len(queryParams) > 0 {
		reqUrl = targetURL + "?" + queryParams.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, "GET", reqUrl, nil)
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
func FetchCharDataAll(ctx context.Context, token, serverID, lang string) ([]model.EndFieldCharInfo, error) {
	if token == "" {
		return nil, fmt.Errorf("token invalid")
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	session := &gachaSession{Token: token, ServerID: serverID, Lang: lang}
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
			data, err := fetchCharDataFromPool(ctx, session, poolType)
			select {
			case results <- result{data: data, err: err}:
			case <-ctx.Done():
				return
			}
		}(pt)
	}
	var allData []model.EndFieldCharInfo
	successCount := 0
	for i := 0; i < len(poolTypes); i++ {
		select {
		case res := <-results:
			if res.err != nil {
				logger.Log.Warn("Failed to fetch pool", zap.Error(res.err))
				continue
			}
			allData = append(allData, res.data...)
			successCount++
		case <-ctx.Done():
			return nil, fmt.Errorf("操作被取消: %w", ctx.Err())
		}
	}
	if successCount == 0 {
		return nil, fmt.Errorf("未获取到任何角色数据")
	}

	// 提取所有限定池的 pool_id 并保存
	poolIDSet := make(map[string]struct{})
	for _, item := range allData {
		if len(item.PoolID) >= 7 && item.PoolID[:7] == "special" {
			poolIDSet[item.PoolID] = struct{}{}
		}
	}
	poolIDs := make([]string, 0, len(poolIDSet))
	for id := range poolIDSet {
		poolIDs = append(poolIDs, id)
	}
	if err := storage.SaveDiscoveredPoolIDs(poolIDs, false); err != nil {
		logger.Log.Error("Failed to save discovered char pool IDs", zap.Error(err))
	}

	return allData, nil
}

func fetchCharDataFromPool(ctx context.Context, sess *gachaSession, poolType string) ([]model.EndFieldCharInfo, error) {
	var list []model.EndFieldCharInfo
	seqID := ""
	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("操作被取消: %w", ctx.Err())
		default:
		}

		var apiResp model.EndFieldGachaResponse
		err := retry.DoWithContext(ctx, func() error {
			params := url.Values{}
			params.Set("lang", sess.Lang)
			params.Set("token", sess.Token)
			params.Set("server_id", sess.ServerID)
			params.Set("pool_type", poolType)
			if seqID != "" {
				params.Set("seq_id", seqID)
			}
			body, err := sess.get(ctx, BaseUrlChar, params, "gacha_char")
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
		time.Sleep(200 * time.Millisecond) // 分页间隔，避免频繁请求
		seqID = apiResp.Data.List[len(apiResp.Data.List)-1].SeqID
	}
	return list, nil
}

// FetchWeaponDataAll 获取所有武器数据
func FetchWeaponDataAll(ctx context.Context, token, serverID, lang string) ([]model.EndFieldWeaponInfo, error) {
	if token == "" {
		return nil, fmt.Errorf("token 为空")
	}
	sess := &gachaSession{Token: token, ServerID: serverID, Lang: lang}
	// 获取账号参与过的武器卡池列表
	pools, err := fetchWeaponPoolList(ctx, sess)
	if err != nil {
		return nil, fmt.Errorf("获取武器卡池列表失败: %v", err)
	}
	var allData []model.EndFieldWeaponInfo
	successCount := 0
	// 遍历每个卡池获取详情
	for _, pool := range pools {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("操作被取消: %w", ctx.Err())
		default:
		}
		poolData, err := fetchWeaponDataByPool(ctx, sess, pool.PoolID)
		if err != nil {
			logger.Log.Warn("Failed to fetch specific weapon pool",
				zap.String("pool_name", pool.PoolName),
				zap.Error(err))
			continue
		}
		successCount++
		allData = append(allData, poolData...)
		time.Sleep(300 * time.Millisecond) // 请求间隔，避免频繁访问官方服务器
	}
	if len(pools) > 0 && successCount == 0 {
		return nil, fmt.Errorf("未获取到任何武器池详情数据")
	}

	// 提取所有武器池的 pool_id 并保存
	poolIDSet := make(map[string]struct{})
	for _, pool := range pools {
		poolIDSet[pool.PoolID] = struct{}{}
	}
	poolIDs := make([]string, 0, len(poolIDSet))
	for id := range poolIDSet {
		poolIDs = append(poolIDs, id)
	}
	if err := storage.SaveDiscoveredPoolIDs(poolIDs, true); err != nil {
		logger.Log.Error("Failed to save discovered weapon pool IDs", zap.Error(err))
	}

	return allData, nil
}

// fetchWeaponPoolList 获取卡池列表
func fetchWeaponPoolList(ctx context.Context, sess *gachaSession) ([]model.EndFieldWeaponPool, error) {
	var poolResp model.EndFieldWeaponPoolResponse

	err := retry.DoWithContext(ctx, func() error {
		params := url.Values{}
		params.Set("lang", sess.Lang)
		params.Set("token", sess.Token)
		params.Set("server_id", sess.ServerID)

		body, err := sess.get(ctx, BaseUrlWeaponPool, params, "gacha_weapon")
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
func fetchWeaponDataByPool(ctx context.Context, sess *gachaSession, poolID string) ([]model.EndFieldWeaponInfo, error) {
	var list []model.EndFieldWeaponInfo
	seqID := ""
	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("操作被取消: %w", ctx.Err())
		default:
		}

		var apiResp model.EndFieldWeaponResponse
		err := retry.DoWithContext(ctx, func() error {
			params := url.Values{}
			params.Set("lang", sess.Lang)
			params.Set("token", sess.Token)
			params.Set("server_id", sess.ServerID)
			params.Set("pool_id", poolID)
			if seqID != "" {
				params.Set("seq_id", seqID)
			}

			body, err := sess.get(ctx, BaseUrlWeapon, params, "gacha_weapon")
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
		time.Sleep(200 * time.Millisecond) // 分页间隔，避免频繁请求
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
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败(Grant): %v", err)
	}
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
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("登录授权请求失败，HTTP 状态码: %d", resp.StatusCode)
	}
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
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("获取账号角色绑定列表请求失败，HTTP 状态码: %d", resp.StatusCode)
	}
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
				nickName := "未知博士"
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
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败(U8Token): %v", err)
	}
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
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("获取用户Token请求失败，HTTP 状态码: %d", resp.StatusCode)
	}
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

func GetUIDByU8Token(u8Token string, serverId string) (string, error) {
	sId, err := strconv.Atoi(serverId)
	if err != nil {
		sId = 1
	}
	reqBody := model.QueryRoleRequest{
		Token:  u8Token,
		Server: sId,
	}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败(QueryRole): %v", err)
	}
	req, err := http.NewRequest("POST", BaseUrlRoleQuery, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		logger.Log.Error("Network error in UID Query", zap.Error(err))
		return "", fmt.Errorf("网络请求失败(QueryRole): %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("获取角色信息请求失败，HTTP 状态码: %d", resp.StatusCode)
	}
	var result model.QueryRoleResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析响应失败(QueryRole): %v", err)
	}
	if result.Status != 0 {
		logger.Log.Error("QueryRole API error",
			zap.Int("status", result.Status),
			zap.String("msg", result.Msg),
		)
		return "", fmt.Errorf("获取角色信息失败: %s", result.Msg)
	}
	return result.Data.Uid, nil
}

// FetchPoolContent 获取卡池详情（不需要token）
func FetchPoolContent(poolID, serverID, lang string) (*model.PoolContentResponse, error) {
	params := url.Values{}
	params.Set("lang", lang)
	params.Set("pool_id", poolID)
	params.Set("server_id", serverID)

	reqUrl := BaseUrlPoolContent + "?" + params.Encode()
	req, err := http.NewRequest("GET", reqUrl, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("网络请求失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP Status: %d", resp.StatusCode)
	}

	var result model.PoolContentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %v", err)
	}

	if result.Code != 0 {
		return nil, fmt.Errorf("API Error: %s", result.Msg)
	}

	return &result, nil
}
