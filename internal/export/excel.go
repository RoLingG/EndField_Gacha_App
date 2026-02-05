package export

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"fmt"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
)

// sheetConfig 定义单个 Sheet 的配置，使用泛型 T 避免类型断言
type sheetConfig[T any] struct {
	SheetName string
	Headers   []string
	Data      []T
	Mapper    func(item T) []interface{}
}

// SaveToExcel 导出数据到 Excel
func SaveToExcel(filePath string, chars []model.EndFieldCharInfo, weapons []model.EndFieldWeaponInfo) error {
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			logger.Log.Error("Failed to close excel file", zap.Error(err))
		}
	}()

	charCfg := sheetConfig[model.EndFieldCharInfo]{
		SheetName: "角色寻访",
		Headers:   []string{"时间戳", "干员", "稀有度", "卡池", "SeqID"},
		Data:      chars,
		Mapper:    mapCharToRow,
	}
	writeSheet(f, charCfg)
	if len(weapons) > 0 {
		f.NewSheet("武器寻访")
		wpCfg := sheetConfig[model.EndFieldWeaponInfo]{
			SheetName: "武器寻访",
			Headers:   []string{"时间戳", "武器ID", "武器名", "类型", "稀有度", "卡池", "SeqID"},
			Data:      weapons,
			Mapper:    mapWeaponToRow,
		}
		writeSheet(f, wpCfg)
	}
	if err := f.SaveAs(filePath); err != nil {
		logger.Log.Error("Export failed", zap.String("path", filePath), zap.Error(err))
		return err
	}
	logger.Log.Info("Excel export success", zap.String("path", filePath))
	return nil
}

// writeSheet 通用 EXCEL 写入函数
func writeSheet[T any](f *excelize.File, cfg sheetConfig[T]) {
	if cfg.SheetName != "Sheet1" && f.GetSheetName(0) == "Sheet1" {
		_ = f.SetSheetName("Sheet1", cfg.SheetName)
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	_ = f.SetSheetRow(cfg.SheetName, "A1", &cfg.Headers)
	lastHeaderCol, _ := excelize.CoordinatesToCellName(len(cfg.Headers), 1)
	_ = f.SetCellStyle(cfg.SheetName, "A1", lastHeaderCol, headerStyle)

	for i, item := range cfg.Data {
		rowData := cfg.Mapper(item)
		rowIdx := i + 2
		cellAddr, _ := excelize.CoordinatesToCellName(1, rowIdx)
		if err := f.SetSheetRow(cfg.SheetName, cellAddr, &rowData); err != nil {
			logger.Log.Warn("Failed to write row",
				zap.String("sheet", cfg.SheetName),
				zap.Int("row", rowIdx),
				zap.Error(err))
		}
	}

	if len(cfg.Data) > 0 {
		lastColName, _ := excelize.ColumnNumberToName(len(cfg.Headers))
		lastRowIdx := len(cfg.Data) + 1
		bottomRightCell := fmt.Sprintf("%s%d", lastColName, lastRowIdx)
		_ = f.SetCellStyle(cfg.SheetName, "A2", bottomRightCell, dataStyle)
		_ = f.AutoFilter(cfg.SheetName, fmt.Sprintf("A1:%s", bottomRightCell), []excelize.AutoFilterOptions{})
	}

	_ = f.SetPanes(cfg.SheetName, &excelize.Panes{
		Freeze:      true,
		Split:       false,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	lastColName, _ := excelize.ColumnNumberToName(len(cfg.Headers))
	_ = f.SetColWidth(cfg.SheetName, "A", lastColName, 20)
}

// mapCharToRow 将角色结构体转换为切片
func mapCharToRow(c model.EndFieldCharInfo) []interface{} {
	return []interface{}{
		c.GachaTs,
		c.CharName,
		c.Rarity,
		c.PoolName,
		c.SeqID,
	}
}

// mapWeaponToRow 将武器结构体转换为切片
func mapWeaponToRow(w model.EndFieldWeaponInfo) []interface{} {
	return []interface{}{
		w.GachaTs,
		w.WeaponID,
		w.WeaponName,
		w.WeaponType,
		w.Rarity,
		w.PoolName,
		w.SeqID,
	}
}
