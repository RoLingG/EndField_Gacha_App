package main

import (
	"fmt"
	"github.com/webview/webview_go"
	"runtime"
)

func main() {
	runtime.LockOSThread()

	w := webview.New(false)
	defer w.Destroy()

	w.SetTitle("Hypergryph Login")
	w.SetSize(500, 700, webview.HintFixed)

	tokenChan := make(chan string, 1)

	script := `
	(function() {
		const originalOpen = XMLHttpRequest.prototype.open;
		const originalSend = XMLHttpRequest.prototype.send;

		XMLHttpRequest.prototype.open = function(method, url, ...rest) {
			this._url = url;
			return originalOpen.apply(this, [method, url, ...rest]);
		};

		XMLHttpRequest.prototype.send = function(...args) {
			this.addEventListener('load', function() {
				// 监听 密码登录 和 验证码登录 接口
				if (this._url && (this._url.includes('token_by_phone_password') || this._url.includes('token_by_phone_code'))) {
					try {
						const data = JSON.parse(this.responseText);
						if (data && data.data && data.data.token) {
							// 发送给 Go
							window.sendTokenToApp(data.data.token);
						}
					} catch (err) {}
				}
			});
			return originalSend.apply(this, args);
		};
	})();
	`

	w.Bind("sendTokenToApp", func(token string) {
		select {
		case tokenChan <- token:
			w.Terminate()
		default:
		}
	})
	w.Init(script)
	w.Navigate("https://user.hypergryph.com/login")
	w.Run()

	select {
	case token := <-tokenChan:
		fmt.Print(token)
	default:
	}
}
