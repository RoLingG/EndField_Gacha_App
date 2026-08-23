package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	fmt.Println("=== EndField Gacha Data Migration Tool ===")
	fmt.Println("修复角色池 JSON 缺失的 kind / nameText 字段")
	fmt.Println()

	// 获取 userdata 目录（相对于可执行文件所在目录）
	exePath, err := os.Executable()
	if err != nil {
		fmt.Println("[ERROR] 无法获取可执行文件路径:", err)
		os.Exit(1)
	}
	exeDir := filepath.Dir(exePath)
	baseDir := filepath.Join(exeDir, "userdata")

	// 如果当前目录没有 userdata，尝试上一级（开发时 go run 的情况）
	if _, err := os.Stat(baseDir); os.IsNotExist(err) {
		baseDir = filepath.Join(filepath.Dir(exeDir), "userdata")
		if _, err := os.Stat(baseDir); os.IsNotExist(err) {
			fmt.Println("[ERROR] 未找到 userdata 目录，请将本工具放在 APP 同级目录下")
			os.Exit(1)
		}
	}

	fmt.Println("扫描目录:", baseDir)
	fmt.Println()

	entries, err := os.ReadDir(baseDir)
	if err != nil {
		fmt.Println("[ERROR] 读取 userdata 目录失败:", err)
		os.Exit(1)
	}

	totalFiles := 0
	migratedFiles := 0
	skippedFiles := 0
	errorFiles := 0

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		profileDir := filepath.Join(baseDir, entry.Name())
		files, err := os.ReadDir(profileDir)
		if err != nil {
			continue
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), "_char_history.json") {
				continue
			}
			totalFiles++
			filePath := filepath.Join(profileDir, f.Name())
			fmt.Printf("  处理: %s/%s ... ", entry.Name(), f.Name())

			raw, err := os.ReadFile(filePath)
			if err != nil {
				fmt.Println("[ERROR] 读取失败:", err)
				errorFiles++
				continue
			}

			fixed, changed := migrateCharData(raw)
			if !changed {
				fmt.Println("[SKIP] 无需修复")
				skippedFiles++
				continue
			}

			if err := os.WriteFile(filePath, fixed, 0644); err != nil {
				fmt.Println("[ERROR] 写入失败:", err)
				errorFiles++
				continue
			}

			fmt.Println("[OK] 已修复")
			migratedFiles++
		}
	}

	fmt.Println()
	fmt.Printf("完成！扫描 %d 个文件，修复 %d 个，跳过 %d 个，失败 %d 个\n",
		totalFiles, migratedFiles, skippedFiles, errorFiles)

	if migratedFiles > 0 {
		fmt.Println()
		fmt.Println("提示: 修复后的数据已写回原文件，旧数据不会丢失。")
	}
}

// migrateCharData 修复旧数据：补齐缺失的 kind 和 nameText 字段
// 判断逻辑：
//   - kind 缺失 + charId 为空 + rarity == 0 → gift_intel_book（寻访情报书）
//   - kind 缺失 + 其他 → draw（正常抽卡）
//   - nameText 缺失 + gift_intel_book → "寻访情报书"
//   - nameText 缺失 + draw → charName
func migrateCharData(raw []byte) ([]byte, bool) {
	var list []map[string]interface{}
	if err := json.Unmarshal(raw, &list); err != nil {
		return raw, false
	}

	changed := false
	for _, item := range list {
		kind, hasKind := item["kind"]
		if !hasKind || kind == "" || kind == nil {
			// 缺失 kind，推断类型
			charId, _ := item["charId"].(string)
			rarity, _ := item["rarity"].(float64) // JSON number → float64
			if charId == "" && rarity == 0 {
				item["kind"] = "gift_intel_book"
			} else {
				item["kind"] = "draw"
			}
			changed = true
		}

		nameText, hasNameText := item["nameText"]
		if !hasNameText || nameText == "" || nameText == nil {
			// 缺失 nameText，根据 kind 填充
			currentKind, _ := item["kind"].(string)
			if currentKind == "gift_intel_book" {
				item["nameText"] = "寻访情报书"
			} else {
				if charName, ok := item["charName"].(string); ok && charName != "" {
					item["nameText"] = charName
				}
			}
			changed = true
		}
	}

	if !changed {
		return raw, false
	}

	output, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return raw, false
	}
	return output, true
}
