# Endfield Gacha App // 终末地寻访记录终端

[![Go Version](https://img.shields.io/badge/Go-%3E%3D1.20-00ADD8.svg)](https://go.dev) ![Wails](https://img.shields.io/badge/Wails-2.0+-C70039.svg) [![Frontend](https://img.shields.io/badge/Frontend-JavaScript-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个极简、安全且具有沉浸式**终末地 (Endfield) 工业风格**的明日方舟官服/B服抽卡记录分析工具。
基于 Wails 构建，无需上传数据，完全本地解析日志文件，提供良好的数据可视化体验。

![Preview](https://rolingg.top/images/EndField/efnew1.png)

![Preview](https://rolingg.top/images/EndField/efnew2.png)

![Preview](https://rolingg.top/images/EndField/efnew3.png)

![Preview](https://rolingg.top/images/EndField/efnew4.png)

![Preview](https://rolingg.top/images/EndField/efnew5.png)

![Preview](https://rolingg.top/images/EndField/efnew6.png)

## ✨ 特性 (Features)

### 📡 多维终端支持 (Multi-Server Support) **[NEW]**

- **双服兼容**: 完美支持 **官服** 与 **B服** 账号。
- **智能识别**: 自动扫描日志，识别当前活跃的服务器 Token。
- **数据隔离**: 不同服务器的数据独立存储（如 `official_char...` / `bilibili_char...`），互不干扰，支持同一客户端管理多个账号记录。

### 📊 核心数据分析 (Core Analytics)

- **多模式启动**:
  - **[ MODE A ] 在线同步**: 自动解析 `HGWebview.log` 获取最新数据并去重合并。
  
  - **[ MODE B ] 离线回溯**: 无需启动游戏，直接读取本地历史存档 (`userdata`)。
  
  - **[ MODE C ] 手动短 Token**: 在鹰角官网通过 API 获取短 Token，在 App 内通过短 Token 调用接口获取数据。
  
    *注意：目前也只有 **[MODE C]** 支持同设备内多服多号（因为是通过官网短 Token 获取信息，可以拿到账号 UID 做区分）*
  
- **可视化仪表盘**:
  
  - 动态环形图展示 4/5/6 星稀有度分布。
  - **智能水位分析**: 支持终末地特殊的保底机制（80抽保底 / 120、240 井）进度追踪，自动计算是否触发垫刀逻辑。
  - 详细的时间轴记录列表与分页查询。

### 💾 本地化与隐私 (Local & Privacy)

- **数据落盘**: 所有抽卡记录自动保存为本地 JSON 文件，不经过任何第三方服务器。
- **一键管理**: 内置 **[ DATA_FOLDER ]** 指令，快速打开数据存储目录进行备份或管理。
- **安全解析**: 仅读取游戏日志中的 URL Token，零风险操作。

### 📥 数据导出 (Data Export) 

- **UID 专属报表**: 导出文件名自动包含 UID（如 `endfield_data_011309408_official.xlsx`）。
- **标准格式化**: 支持一键导出 `.xlsx` 格式的 Excel 表格。
- **多表分页**: 自动将“角色寻访”与“武器寻访”拆分为独立工作表（Sheet），方便整理与存档。

### 🎨 工业美学 (Industrial Design)

- **沉浸式 UI**: 深度复刻终末地游戏内终端界面 (UI)。
- **轻量高效**: 基于 Golang + Wails，系统资源占用极低，启动即用。

### ⚠️ 注意事项 (Operation Notes)

- **PC 客户端限定**: 本工具基于文件系统解析 (`HGWebview.log`)，目前仅适用于 **PC 客户端**，不支持 Android/iOS 移动端直接读取。

- **网络环境**: 在线同步模式依赖终末地官方 API 接口，请确保您的网络环境可以正常访问游戏服务器。

- **同设备单服多号冲突:** 由于 Token 获取途径问题，目前无法获得用户 `UID` 进行账号区分，**目前只支持同设备一服一号**，同设备登录多号极大概率会导致 JSON 数据同步出互篡，出现此类问题只能删除本地 JSON 落盘数据，重新累计抽卡历史数据。

  > 要不出问题也简单，在打开软件在线同步前，再登录回累计数据的账号访问角色/武器池，让 `HGWebview.log` 日志文件追加写入最新账号的 Webview URL 访问记录。
  >
  > 这样软件拿到的最新 Token 就是累计账号用户的 Token，在登录其他账号访问卡池记录之前，不会获取其他账号的数据。

### 🛑 严重安全警告 (CRITICAL WARNING)

- **🚫 绝对禁止分享日志**：请务必保护好您的 `HGWebview.log` 文件！其中包含的 **Token** 相当于您的临时登录“钥匙”。**严禁**将日志文件直接发送给他人或在网络上公开，否则可能导致账号抽卡数据隐私泄露。
  
- **💸 本软件完全免费**：这是一个开源项目，**禁止任何形式的倒卖**。如果您是付费获取的本软件，说明您遭遇了诈骗。

## 🛠️ 技术栈 (Tech Stack)

- **Core Framework**: [Wails v2](https://wails.io/)
- **Backend**:
  - GoLang 1.20+
  - 标准库 `encoding/json` 处理数据存储
  - `os/exec` 实现系统级文件管理交互
- **Frontend**:
  - **HTML5 / CSS3**: 自定义 CSS Variables，Flex 布局，复刻游戏内动效。
  - **JavaScript**: 原生 JS 模块化开发，无繁重框架依赖。
  - **Chart.js**: 数据可视化图表绘制。
  - **MDUI**: 辅助 UI 组件库。

## 🚀 使用指南 (Usage)

### 首次使用 / 更新数据 (Online Mode)

#### 扫描日志的形式

1. 启动《明日方舟：终末地》PC 客户端。
2. 打开游戏内的【寻访】界面，并点击一次【历史记录】。
   *   *注：如果您同时游玩官服和B服，请分别登录并打开一次历史记录。*
3. 打开本工具，点击 **[ ONLINE INITIALIZE ]**。
4. **服务器选择**:
   - 如果工具检测到单个账号，将自动同步。
   - 如果工具检测到**双端数据**，界面将弹出选择框，点击对应的服务器即可开始同步。

#### 手输短Token的形式

1. 在鹰角官网通过 F12 网络对应接口获取短 Token
2. 打开本工具，点击 **[ WEB TOKEN SYNC]**。
3. 在 Input 框内输入短 Token，并点击 **[ CONNECT]**。
   - *注：如果您同时游玩官服和B服，并且B服有在鹰角账号做绑定，点击后会有区服角色选择。*

### 查看历史 / 离线模式 (Local Mode)

1. 直接打开本工具。
2. 点击 **[ LOCAL INITIALIZE ]**。
3. 如果本地同时存有双服存档，工具会提示您选择要加载的服务器档案。

### **导出寻访报表 (Export Data)**

1. 在成功加载任意服务器的数据后（ONLINE 或 LOCAL 模式均可）。
2. 点击顶部导航栏的 **`[ EXPORT_EXCEL ]`** 指令。
3. 在系统弹窗中选择保存路径，工具将根据当前选择的服务器自动命名文件（如 `endfield_data_official.xlsx`）。

## 📂 目录结构 (Directory)

数据默认存储在用户配置目录下，可通过界面顶部的 `[ DATA_FOLDER ]` 按钮直接访问。文件名已更新以支持多服隔离：

```cmd
userdata/
├── uid/                      		  // [精准模式] 特定UID存档
│   ├── official_char_history.json    // 角色池记录
│   └── official_weapon_history.json  // 武器池记录
│
├── local/                            // [通用模式] 日志扫描/旧版存档
│   ├── bilibili_char_history.json    // B服角色
│   ├── bilibili_weapon_history.json  // B服武器
│   ├── official_char_history.json    // 官服角色
│   └── official_weapon_history.json  // 官服武器
│
└── logs/                             // 软件运行日志
```

## ⚙️ 开发环境 (Development)

### 前置要求

- Go ≥ 1.20
- Node.js ≥ 18
- Wails CLI

```bash
# 安装 Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 克隆项目
git clone https://github.com/your-username/Endfield-Gacha-Log.git

# 进入目录
cd Endfield-Gacha-Log

# 启动开发模式 (热重载)
wails dev

# 编译构建 (Windows)
wails build
```

## ⚖️ 免责声明 (Disclaimer)

> **本项目为非官方工具，与 [鹰角网络 (Hypergryph)](https://www.hypergryph.com) 及其旗下组织团体、工作室没有任何关联。所有游戏图片与数据版权归各自所有者所有。**

- 本软件按 **“现状”** 提供，不保证可用性、稳定性或数据准确性，使用过程中造成的任何数据损失、账号封禁、功能异常或经济损失，均由用户自行承担。
- 本软件仅供 **个人学习与研究** 使用，不承担因商业化使用或再分发产生的任何责任。
- 使用本软件须遵守所在国家/地区的法律法规、游戏/平台服务条款及知识产权要求；如有合规/安全疑虑，请 **立即停止使用并卸载**。
- 本项目 **不采集、存储或上传** 用户的个人隐私数据，涉及的游戏数据均由用户自行选择导入/导出。

## 📄 License

MIT License

