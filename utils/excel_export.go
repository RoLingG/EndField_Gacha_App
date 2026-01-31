package utils

import (
	"fmt"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
)

func ExportToExcel(filePath string, charList []EndFieldCharInfo, weaponList []EndFieldWeaponInfo) error {
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			Log.Error("Failed to close excel file handle", zap.Error(err))
		}
	}()
	charSheet := "角色抽卡记录"
	f.SetSheetName("Sheet1", charSheet)
	writeCharSheet(f, charSheet, charList)
	weaponSheet := "武器抽卡记录"
	f.NewSheet(weaponSheet)
	writeWeaponSheet(f, weaponSheet, weaponList)
	if err := f.SaveAs(filePath); err != nil {
		Log.Error("Failed to save excel file", zap.String("file", filePath), zap.Error(err))
		return err
	}
	Log.Info("Excel file saved successfully", zap.String("file", filePath))
	return nil
}

// writeCharSheet 写入角色数据
func writeCharSheet(f *excelize.File, sheetName string, data []EndFieldCharInfo) {
	headers := []string{"抽卡时间", "角色ID", "角色名称", "稀有度", "卡池ID", "卡池名称"}
	setSheetHeader(f, sheetName, headers)
	for i, item := range data {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), item.GachaTs)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), item.CharID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), item.CharName)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), item.Rarity)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), item.PoolID)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), item.PoolName)
	}
	f.SetColWidth(sheetName, "A", "F", 20)
}

// writeWeaponSheet 写入武器数据
func writeWeaponSheet(f *excelize.File, sheetName string, data []EndFieldWeaponInfo) {
	headers := []string{"抽卡时间", "武器id", "武器名称", "稀有度", "武器类型", "卡池名称"}
	setSheetHeader(f, sheetName, headers)
	for i, item := range data {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), item.GachaTs)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), item.WeaponID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), item.WeaponName)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), item.Rarity)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), item.WeaponType)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), item.PoolName)
	}
	f.SetColWidth(sheetName, "A", "F", 20)
}

// setSheetHeader 通用表头设置
func setSheetHeader(f *excelize.File, sheetName string, headers []string) {
	// 定义表头样式
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0E0E0"}, Pattern: 1},
	})
	for i, header := range headers {
		// ASCII 65 is 'A'
		cellName := fmt.Sprintf("%c1", 65+i)
		f.SetCellValue(sheetName, cellName, header)
		f.SetCellStyle(sheetName, cellName, cellName, style)
	}
}
