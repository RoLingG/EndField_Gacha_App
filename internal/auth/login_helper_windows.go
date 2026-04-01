//go:build windows
// +build windows

package auth

import _ "embed"

//go:embed login_helper.exe
var loginHelperBinary []byte

const helperName = "login_helper.exe"
