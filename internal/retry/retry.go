// internal/retry/retry.go
package retry

import (
	"fmt"
	"time"
)

type Config struct {
	MaxAttempts  int           // 最大重试次数
	InitialDelay time.Duration // 初始等待时间
	MaxDelay     time.Duration // 最大等待时间
	Multiplier   float64       // 每次等待时间的倍数
}

var DefaultConfig = Config{
	MaxAttempts:  3,
	InitialDelay: 1 * time.Second,
	MaxDelay:     10 * time.Second,
	Multiplier:   2.0,
}

// Do 执行带重试的函数
func Do(fn func() error, cfg Config) error {
	var lastErr error
	delay := cfg.InitialDelay
	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		// 执行函数
		lastErr = fn()
		// 成功则返回
		if lastErr == nil {
			return nil
		}
		if attempt < cfg.MaxAttempts {
			time.Sleep(delay)
			// 计算下次等待时间（指数增长）
			delay = time.Duration(float64(delay) * cfg.Multiplier)
			if delay > cfg.MaxDelay {
				delay = cfg.MaxDelay
			}
		}
	}
	// 所有重试都失败
	return fmt.Errorf("重试 %d 次后仍失败: %v", cfg.MaxAttempts, lastErr)
}
