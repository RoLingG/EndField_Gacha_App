package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"io"
	"net/http"
	"net/url"
)

const (
	AppCodeEndfield = "endfield"
	AppCodeLogin    = "be36d44aa36bfb5b"
)

type GrantRequest struct {
	AppCode string `json:"appCode"`
	Token   string `json:"token"`
	Type    int    `json:"type"`
}

type GrantResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		Token string `json:"token"`
		HgId  string `json:"hgId"`
	} `json:"data"`
}

type BindingResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		List []struct {
			AppCode     string `json:"appCode"`
			BindingList []struct {
				Uid         string `json:"uid"`
				IsOfficial  bool   `json:"isOfficial"`
				ChannelName string `json:"channelName"`
				Roles       []struct {
					RoleId   string `json:"roleId"`
					NickName string `json:"nickName"`
					Level    int    `json:"level"`
				} `json:"roles"`
			} `json:"bindingList"`
		} `json:"list"`
	} `json:"data"`
}

type PlayerBindingInfo struct {
	Uid         string `json:"uid"`         // 游戏UID
	NickName    string `json:"nickName"`    // 角色昵称
	Level       int    `json:"level"`       // 等级
	ChannelName string `json:"channelName"` // 渠道名称 (官服/B服等)
	IsOfficial  bool   `json:"isOfficial"`  // 是否官服
	ServerType  string `json:"serverType"`  // "official" or "bilibili"
}

type U8TokenRequest struct {
	Token string `json:"token"`
	Uid   string `json:"uid"`
}

type U8TokenResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		Token string `json:"token"`
	} `json:"data"`
}

func GetGrantToken(shortToken string) (string, error) {
	reqBody := GrantRequest{
		AppCode: AppCodeLogin,
		Token:   shortToken,
		Type:    1,
	}
	jsonBody, _ := json.Marshal(reqBody)
	resp, err := http.Post("https://as.hypergryph.com/user/oauth2/v2/grant", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		Log.Error("Network error in Grant step", zap.Error(err))
		return "", fmt.Errorf("网络请求失败(Grant): %v", err)
	}
	defer resp.Body.Close()
	var result GrantResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析响应失败(Grant): %v", err)
	}
	if result.Status != 0 {
		Log.Error("Grant API returned error", zap.Int("status", result.Status), zap.String("msg", result.Msg))
		return "", fmt.Errorf("登录授权失败: %s", result.Msg)
	}
	return result.Data.Token, nil
}

func GetPlayerBindings(hgToken string) ([]PlayerBindingInfo, error) {
	fmt.Printf("hgtoken = %v\n", hgToken)
	params := url.Values{}
	params.Add("token", hgToken)
	params.Add("appCode", AppCodeEndfield)

	targetUrl := "https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list?" + params.Encode()
	resp, err := http.Get(targetUrl)
	if err != nil {
		return nil, fmt.Errorf("网络请求失败(Binding): %v", err)
	}
	defer resp.Body.Close()

	var result BindingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析响应失败(Binding): %v", err)
	}
	if result.Status != 0 {
		return nil, fmt.Errorf("获取绑定列表失败: %s", result.Msg)
	}

	var playerList []PlayerBindingInfo

	for _, app := range result.Data.List {
		if app.AppCode == AppCodeEndfield {
			for _, binding := range app.BindingList {
				nickName := "未知指挥官"
				level := 0
				if len(binding.Roles) > 0 {
					nickName = binding.Roles[0].NickName
					level = binding.Roles[0].Level
				}
				serverType := "未知服务器类型"
				if binding.IsOfficial {
					serverType = "official"
				} else if !binding.IsOfficial && binding.ChannelName == "bilibili服" {
					serverType = "bilibili"
				}
				playerList = append(playerList, PlayerBindingInfo{
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
	fmt.Printf("playerList = %v\n", playerList)
	return playerList, nil
}

func GetU8Token(hgToken, hgUid string) (string, error) {
	reqBody := U8TokenRequest{
		Token: hgToken,
		Uid:   hgUid,
	}
	jsonBody, _ := json.Marshal(reqBody)
	resp, err := http.Post("https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("网络请求失败(U8Token): %v", err)
	}
	defer resp.Body.Close()

	var result U8TokenResponse
	bodyBytes, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return "", fmt.Errorf("解析响应失败(U8Token): %v", err)
	}

	if result.Status != 0 {
		Log.Error("U8Token API error", zap.String("response", string(bodyBytes)))
		return "", fmt.Errorf("获取游戏Token失败: %s", result.Msg)
	}

	return result.Data.Token, nil
}
