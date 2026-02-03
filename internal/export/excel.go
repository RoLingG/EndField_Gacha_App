package export

import (
	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"fmt"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
)

func SaveToExcel(filePath string, chars []model.EndFieldCharInfo, weapons []model.EndFieldWeaponInfo) error {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()

	// 角色 Sheet
	charSheet := "角色寻访"
	f.SetSheetName("Sheet1", charSheet)
	writeHeader(f, charSheet, []string{"时间", "干员", "稀有度", "卡池"})
	for i, c := range chars {
		row := i + 2
		f.SetCellValue(charSheet, fmt.Sprintf("A%d", row), c.GachaTs)
		f.SetCellValue(charSheet, fmt.Sprintf("B%d", row), c.CharName)
		f.SetCellValue(charSheet, fmt.Sprintf("C%d", row), c.Rarity)
		f.SetCellValue(charSheet, fmt.Sprintf("D%d", row), c.PoolName)
	}

	// 武器 Sheet
	if len(weapons) > 0 {
		wpSheet := "武器寻访"
		f.NewSheet(wpSheet)
		writeHeader(f, wpSheet, []string{"时间", "武器", "类型", "稀有度", "卡池"})
		for i, w := range weapons {
			row := i + 2
			f.SetCellValue(wpSheet, fmt.Sprintf("A%d", row), w.GachaTs)
			f.SetCellValue(wpSheet, fmt.Sprintf("B%d", row), w.WeaponName)
			f.SetCellValue(wpSheet, fmt.Sprintf("C%d", row), w.WeaponType)
			f.SetCellValue(wpSheet, fmt.Sprintf("D%d", row), w.Rarity)
			f.SetCellValue(wpSheet, fmt.Sprintf("E%d", row), w.PoolName)
		}
	}

	if err := f.SaveAs(filePath); err != nil {
		logger.Log.Error("Export failed", zap.Error(err))
		return err
	}
	return nil
}

func writeHeader(f *excelize.File, sheet string, headers []string) {
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#DDDDDD"}, Pattern: 1},
	})
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 65+i)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, style)
	}
}
