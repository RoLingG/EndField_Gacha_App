//go:build windows
// +build windows

package auth

import (
	"os/exec"
	"syscall"
)

func applyNoWindowAttr(cmd *exec.Cmd) {
	const CreateNoWindow = 0x08000000
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: CreateNoWindow,
	}
}
