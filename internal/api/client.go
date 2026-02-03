package api

import (
	"net/http"
	"time"
)

// 全局复用 Client，设置超时防止挂死
var httpClient = &http.Client{
	Timeout: 15 * time.Second,
}
