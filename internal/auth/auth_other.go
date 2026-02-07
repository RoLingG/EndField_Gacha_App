//go:build !windows
// +build !windows

package auth

import "os/exec"

func applyNoWindowAttr(cmd *exec.Cmd) {
	// 非 Windows：什么都不做
}
