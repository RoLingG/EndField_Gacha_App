package utils

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
	"os"
	"path/filepath"
	"time"
)

var Log *zap.Logger

// InitLogger 初始化日志系统
func InitLogger() {
	// 获取App存储路径
	exePath, _ := os.Executable()
	exeDir := filepath.Dir(exePath)
	logDir := filepath.Join(exeDir, "userdata", "logs")
	logFile := filepath.Join(logDir, "endfield_gacha.log")
	// 保证目录存在
	_ = os.MkdirAll(logDir, 0755)
	// 配置日志轮转，防止日志膨胀，只保留最近日志记录
	rotator := &lumberjack.Logger{
		Filename:   logFile,
		MaxSize:    5,
		MaxAge:     5,
		MaxBackups: 30,
		Compress:   true,
	}
	// 配置JSON zap日志核心
	encoderConfig := zap.NewProductionEncoderConfig()
	customTimeEncoder := func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.Format("2006-01-02 15:04:05"))
	}
	encoderConfig.EncodeTime = customTimeEncoder
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder // INFO, ERROR
	// 开发者模式，控制台输出彩色日志，文件输出JSON或文本
	fileEncoder := zapcore.NewConsoleEncoder(encoderConfig)
	// 配置控制台 zap日志核心
	consoleConfig := encoderConfig
	consoleConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	consoleEncoder := zapcore.NewConsoleEncoder(consoleConfig)
	fileCore := zapcore.NewCore(
		fileEncoder,
		zapcore.AddSync(rotator),
		zapcore.DebugLevel,
	)
	consoleCore := zapcore.NewCore(
		consoleEncoder,
		zapcore.AddSync(os.Stdout),
		zapcore.DebugLevel,
	)
	core := zapcore.NewTee(fileCore, consoleCore)
	Log = zap.New(core, zap.AddCaller())
	Log.Info("==========================================")
	Log.Info("Endfield Terminal System Startup",
		zap.String("version", "v1.3.0"),
		zap.Time("boot_time", time.Now()),
	)
}
func SyncLog() {
	if Log != nil {
		_ = Log.Sync()
	}
}
