package export

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"time"

	"go.uber.org/zap"
)

func formatTimestamp(ts string) string {
	// 十进制 Unix 时间戳转换成 int64 类型
	ms, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return ts // 解析失败返回原值
	}
	return time.UnixMilli(ms).Format("2006-01-02 15:04:05")
}

func charDisplayName(c model.EndFieldCharInfo) string {
	if c.NameText != "" {
		return c.NameText
	}
	return c.CharName
}

func SaveToCSV(filePath string, chars []model.EndFieldCharInfo, weapons []model.EndFieldWeaponInfo) error {
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %v", err)
	}
	defer func() {
		if cerr := f.Close(); cerr != nil {
			fmt.Printf("关闭文件失败: %v\n", cerr)
		}
	}()
	// 写入 BOM 标记为 UTF-8 字符
	if _, err := f.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return fmt.Errorf("写入BOM失败: %v", err)
	}
	w := csv.NewWriter(f)
	if len(chars) > 0 {
		if err := w.Write([]string{"角色寻访记录"}); err != nil {
			return err
		}
		if err := w.Write([]string{"时间戳", "干员ID", "干员名", "稀有度", "卡池", "SeqID"}); err != nil {
			return err
		}
		for _, char := range chars {
			row := []string{
				formatTimestamp(char.GachaTs),
				char.CharID,
				charDisplayName(char),
				fmt.Sprintf("%d", char.Rarity),
				char.PoolName,
				char.SeqID,
			}
			if err := w.Write(row); err != nil {
				return err
			}
		}
	}

	if len(chars) > 0 && len(weapons) > 0 {
		if err := w.Write([]string{}); err != nil {
			return err
		}
	}

	if len(weapons) > 0 {
		if err := w.Write([]string{"武器寻访记录"}); err != nil {
			return err
		}
		if err := w.Write([]string{"时间戳", "武器ID", "武器名", "类型", "稀有度", "卡池", "SeqID"}); err != nil {
			return err
		}
		for _, weapon := range weapons {
			row := []string{
				formatTimestamp(weapon.GachaTs),
				weapon.WeaponID,
				weapon.WeaponName,
				weapon.WeaponType,
				fmt.Sprintf("%d", weapon.Rarity),
				weapon.PoolName,
				weapon.SeqID,
			}
			if err := w.Write(row); err != nil {
				return err
			}
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return fmt.Errorf("写入 CSV 失败: %v", err)
	}
	logger.Log.Info("CSV 导出成功", zap.String("path", filePath))
	return nil
}
