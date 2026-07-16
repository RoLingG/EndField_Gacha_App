package model

const (
	ServerOfficial = "official"
	ServerBilibili = "bilibili"
	PoolTypeChar   = "char"
	PoolTypeWeapon = "weapon"
)

type GachaItem interface {
	GetSeqID() string
	GetGachaTime() string
}

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

func (c EndFieldCharInfo) GetSeqID() string     { return c.SeqID }
func (c EndFieldCharInfo) GetGachaTime() string { return c.GachaTs }

type EndFieldCharData struct {
	List    []EndFieldCharInfo `json:"list"`
	HasMore bool               `json:"hasMore"`
}

type EndFieldGachaResponse struct {
	Code int              `json:"code"`
	Data EndFieldCharData `json:"data"`
	Msg  string           `json:"msg"`
}

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

func (w EndFieldWeaponInfo) GetSeqID() string     { return w.SeqID }
func (w EndFieldWeaponInfo) GetGachaTime() string { return w.GachaTs }

type EndFieldWeaponData struct {
	List    []EndFieldWeaponInfo `json:"list"`
	HasMore bool                 `json:"hasMore"`
}

type EndFieldWeaponResponse struct {
	Code int                `json:"code"`
	Data EndFieldWeaponData `json:"data"`
	Msg  string             `json:"msg"`
}

type EndFieldWeaponPoolResponse struct {
	Code int                  `json:"code"`
	Data []EndFieldWeaponPool `json:"data"`
	Msg  string               `json:"msg"`
}

type EndFieldWeaponPool struct {
	PoolID   string `json:"poolId"`
	PoolName string `json:"poolName"`
}

type PlayerBindingInfo struct {
	Uid         string `json:"uid"`
	NickName    string `json:"nickName"`
	Level       int    `json:"level"`
	ChannelName string `json:"channelName"`
	IsOfficial  bool   `json:"isOfficial"`
	ServerType  string `json:"serverType"` // "official" or "bilibili"
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

type QueryRoleRequest struct {
	Token  string `json:"token"`
	Server int    `json:"server"`
}
type QueryRoleResponse struct {
	Status int    `json:"status"`
	Msg    string `json:"msg"`
	Data   struct {
		Uid     string `json:"uid"`
		AppCode string `json:"appCode"`
	} `json:"data"`
}

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

type LocalArchive struct {
	Uid       string   `json:"uid"`
	Timestamp string   `json:"timestamp"`
	Path      string   `json:"path"`
	Servers   []string `json:"servers"`
}

type ServerTokens struct {
	Official string
	Bilibili string
}

// PoolContentResponse 卡池详情接口响应
type PoolContentResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Pool struct {
			PoolGachaType string `json:"pool_gacha_type"`
			PoolName      string `json:"pool_name"`
			PoolType      string `json:"pool_type"`
			Up6Name       string `json:"up6_name"`
			Up6Image      string `json:"up6_image"`
			All           []struct {
				ID     string `json:"id"`
				Name   string `json:"name"`
				Rarity int    `json:"rarity"`
			} `json:"all"`
		} `json:"pool"`
	} `json:"data"`
}

// PoolConfig 卡池配置（用于前端）
type PoolConfig struct {
	PoolName     string `json:"poolName"`
	PoolType     string `json:"poolType"`
	Up6Name      string `json:"up6Name"`
	Up6CharID    string `json:"up6CharId,omitempty"`
	Up6WeaponID  string `json:"up6WeaponId,omitempty"`
	GachaType    string `json:"gachaType"`
	LastUpdate   string `json:"lastUpdate"`
}

// PoolConfigList 卡池配置列表
type PoolConfigList struct {
	CharPools   []PoolConfig `json:"charPools"`
	WeaponPools []PoolConfig `json:"weaponPools"`
	LastUpdate  string       `json:"lastUpdate"`
}
