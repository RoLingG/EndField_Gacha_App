# Endfield Gacha Log // 终末地寻访记录终端

[![Go Version](https://img.shields.io/badge/Go-%3E%3D1.20-00ADD8.svg)](https://go.dev) ![Wails](https://img.shields.io/badge/Wails-2.0+-C70039.svg) [![Frontend](https://img.shields.io/badge/Frontend-JavaScript-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个极简、安全且具有沉浸式**终末地 (Endfield) 工业风格**的明日方舟官服抽卡记录分析工具。
基于 Wails 构建，无需上传数据，完全本地解析日志文件，提供良好的数据可视化体验。

![Preview](https://rolingg.top/images/EndField/endfield1.png)

![Preview](https://rolingg.top/images/EndField/endfield2.png)

![Preview](https://rolingg.top/images/EndField/endfield3.png)

## ✨ 特性 (Features)

- **📊 核心数据分析**:
    - **仪表盘**: 环形图展示 4/5/6 星分布。
    - **关键指标**: 当前水位 (Pity)、总抽数、六星综合出货率。
    - **详细列表**: 最近寻访记录的时间轴展示。
- **🔒 安全隐私**:
    - 纯本地解析 `HGWebview.log`，不经过第三方服务器。
- **⚡ 轻量高效**:
    - 基于 Golang + Wails，系统资源占用极低。

## 🛠️ 技术栈 (Tech Stack)

- **Core Framework**: [Wails v2](https://wails.io/) (Go + Webview)
- **Backend**: Golang 1.20+
- **Frontend**:
    - **HTML5 / CSS3**: 自定义 Flex 布局，CSS 动画。
    - **JavaScript (ES6+)**: 原生 JS 逻辑，无繁重框架依赖。
    - **Chart.js**: 数据可视化图表绘制。
    - **MDUI**: (部分引用)

## 🚀 开发指南 (Development)

### 前置要求

- Go ≥ 1.20
- Node.js ≥ 18
- Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
