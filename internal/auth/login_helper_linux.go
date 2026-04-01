//go:build linux
// +build linux

package auth

import _ "embed"

//go:embed login_helper
var loginHelperBinary []byte

const helperName = "login_helper"
