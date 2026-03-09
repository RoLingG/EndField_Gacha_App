package auth

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"bytes"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"go.uber.org/zap"
)

//go:embed login_helper.exe
var loginHelperBinary []byte

// OpenLoginWindow 释放并启动子进程进行登录，并获取 Token
func OpenLoginWindow() (string, error) {
	logger.Log.Info("Prepare to launch embedded login helper process...")

	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	baseDir := filepath.Dir(exePath)
	helperPath := filepath.Join(baseDir, "login_helper.exe")

	logger.Log.Info(fmt.Sprintf("Target helper path: %s", helperPath))

	// 尝试写入文件，如果是因为权限不够导致写入失败且文件不存在，才报错 (这样就不用外置可执行程序了)
	err = os.WriteFile(helperPath, loginHelperBinary, 0755)
	if err != nil {
		// 检查文件是否已经存在
		if _, statErr := os.Stat(helperPath); statErr == nil {
			logger.Log.Warn("Login helper file is locked (busy), skipping extraction and using existing file.", zap.Error(err))
		} else {
			// 文件不存在，且写入失败（可能是目录权限问题）
			logger.Log.Error("Failed to extract helper and file does not exist", zap.Error(err))
			return "", fmt.Errorf("无法释放登录组件: %v", err)
		}
	} else {
		logger.Log.Info("Login helper extracted/updated successfully.")
	}

	cmd := exec.Command(helperPath)
	applyNoWindowAttr(cmd)

	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	logger.Log.Info("Starting helper process...")

	if err := cmd.Run(); err != nil {
		stderrText := strings.TrimSpace(stderr.String())
		if stderrText != "" {
			logger.Log.Error("Login helper exited with error", zap.Error(err), zap.String("stderr", stderrText))
			return "", fmt.Errorf("登录组件执行失败: %v: %s", err, stderrText)
		}
		logger.Log.Error("Login helper exited with error", zap.Error(err))
		return "", fmt.Errorf("登录组件执行失败: %v", err)
	}

	token := strings.TrimSpace(stdout.String())
	if token == "" {
		stderrText := strings.TrimSpace(stderr.String())
		if stderrText != "" {
			return "", fmt.Errorf("未获取到 Token，登录组件输出错误信息: %s", stderrText)
		}
		return "", fmt.Errorf("未检测到 Token（窗口被关闭、未完成登录或登录组件未输出有效结果）")
	}

	logger.Log.Info("Successfully captured token.")
	return token, nil
}
