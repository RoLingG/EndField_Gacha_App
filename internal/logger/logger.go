package logger

import (
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log *zap.Logger

func InitLogger() {
	exePath, _ := os.Executable()
	exeDir := filepath.Dir(exePath)
	logDir := filepath.Join(exeDir, "userdata", "logs")
	_ = os.MkdirAll(logDir, 0755)

	logFile := filepath.Join(logDir, "endfield_gacha.log")

	rotator := &lumberjack.Logger{
		Filename:   logFile,
		MaxSize:    5,
		MaxAge:     5,
		MaxBackups: 10,
		Compress:   true,
	}

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.Format("2006-01-02 15:04:05"))
	}
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	// 文件输出核心
	fileCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(rotator),
		zapcore.DebugLevel,
	)

	// 控制台输出核心 (带颜色)
	consoleConfig := encoderConfig
	consoleConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	consoleCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(consoleConfig),
		zapcore.AddSync(os.Stdout),
		zapcore.DebugLevel,
	)

	core := zapcore.NewTee(fileCore, consoleCore)
	Log = zap.New(core, zap.AddCaller())

	Log.Info("Endfield Terminal System Startup", zap.String("version", "v1.6.2"))
}

func Sync() {
	if Log != nil {
		_ = Log.Sync()
	}
}
