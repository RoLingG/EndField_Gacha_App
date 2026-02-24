# Endfield Gacha App // 终末地寻访记录终端

[![Go Version](https://img.shields.io/badge/Go-%3E%3D1.20-00ADD8.svg)](https://go.dev) ![Wails](https://img.shields.io/badge/Wails-2.0+-C70039.svg) [![Frontend](https://img.shields.io/badge/Frontend-JavaScript-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个极简、安全且具有沉浸式**终末地 (Endfield) 工业风格**的明日方舟官服/B服抽卡记录分析工具。
基于 Wails 构建，无需上传数据，完全本地解析日志文件，提供良好的数据可视化体验。

![Preview](https://rolingg.top/images/EndField/efwww1.png)

![Preview](https://rolingg.top/images/EndField/efwww2.png)

![Preview](https://rolingg.top/images/EndField/efwww3.png)

![Preview](https://rolingg.top/images/EndField/efwww4.png)

![Preview](https://rolingg.top/images/EndField/efwww5.png)

![Preview](https://rolingg.top/images/EndField/efwww6.png)

## ✨ 特性 (Features)

### 📡 多维终端支持 (Multi-Server Support)

- **双服兼容**: 完美支持 **官服** 与 **B服** 账号。
- **智能识别**: 自动扫描日志，识别当前活跃的服务器 Token。
- **数据隔离**: 不同服务器的数据独立存储（如 `official_char...` / `bilibili_char...`），互不干扰，支持同一客户端管理多个账号记录。

### 📊 核心数据分析 (Core Analytics)

- **多模式启动**:
  - **[ MODE A ] 在线同步**: 自动解析 `HGWebview.log` 获取最新数据并去重合并。
  - **[ MODE B ] 离线回溯**: 无需启动游戏，直接读取本地历史存档 (`userdata`)。
  - **[ MODE C ] Web Token 同步**: 
    - **支持内置登录窗口**: 直接在软件内唤起官方登录页，安全快捷获取 Token。
    - **支持手动短 Token**: 兼容从浏览器开发者工具手动获取的 Token。
    - *注意：**[ MODE C ]** 支持通过 UID 区分同设备内的多个账号。*
  - **[ MODE D ] 临时导入 Json 文件**: 导入 Json 文件读取数据。
    - *注意：**[ MODE D ]** 仅支持本软件同步下来的 Json 文件，导入其他软件的 Json 文件可能会出错。*
- **可视化仪表盘**:
  - 动态环形图展示 4/5/6 星稀有度分布。
  - 详细的时间轴记录列表与分页查询。
  - 支持终末地特殊的保底机制（80抽保底 / 120、240 井）进度追踪，自动计算是否触发垫刀逻辑。

### 💾 本地化与隐私 (Local & Privacy)

- **数据落盘**: 所有抽卡记录自动保存为本地 JSON 文件，不经过任何第三方服务器。
- **原子备份**: 数据会先写入临时文件，意外出错能够保留 `.bak` 备份文件，随时回退到旧版有效记录。
- **一键管理**: 内置 **[ DATA_FOLDER ]** 指令，快速打开数据存储目录进行备份或管理。
- **安全解析**: Log 模式下仅读取游戏日志中的 URL Token，零风险操作。
- **智能归档**: 
  - 自动识别并复用已存在的 UID 目录，避免数据碎片化。
  - 新账号首次同步时，自动创建带 **高可读性时间戳** 的专属目录（如 `uid_2023-10-27_14-30`）。

### 📥 数据导出 (Data Export) 

- **UID 专属报表**: 导出文件名自动包含 UID（如 `endfield_data_011xxx408_official.xlsx`）。
- **标准格式化**: 支持一键导出 `.xlsx` 格式的 Excel 表格。
- **多表分页**: 自动将“角色寻访”与“武器寻访”拆分为独立工作表，方便整理与存档。

### 🖥️ 桌面集成 (Desktop Integration)

- **系统托盘**: 支持最小化到系统托盘，右键菜单提供便捷控制。
- **无感运行**: 隐藏窗口后自动折叠至托盘区，保持后台静默运行。

### 🎨 工业美学 (Industrial Design)

- **沉浸式 UI**: 深度复刻终末地游戏内终端界面 (UI)。
- **轻量高效**: 基于 GoLang + Wails，系统资源占用极低，启动即用。

### ⚠️ 注意事项 (Operation Notes)

- **Win 客户端限定**: 目前仅适用于 **Windows** 系统，不支持 MacOS/Linux 系统，也不支持 Android/iOS 移动端直接读取。（手机游玩的用户如有需求，可以使用短 Token 的形式获取抽卡数据）
- **网络环境**: Log 模式依赖终末地官方 API 接口，请确保您的网络环境可以正常访问游戏服务器。
- **可执行文件生成**: 使用**内置登录窗口方式**登录会自动获取短 Token，但使用这个方式会在软件同目录下生成一个 `login_helper.exe` 的可执行文件。该文件可能会触发杀毒软件拦截，本项目承诺该可执行文件完全无毒、无任何涉及用户隐私的违规操作。

### 🛑 严重安全警告 (CRITICAL WARNING)

- **🚫 绝对禁止分享日志**：请务必保护好您的 `HGWebview.log` 文件！其中包含的 **Token** 相当于您的**临时登录“钥匙”**。**严禁**将日志文件直接发送给他人或在网络上公开，否则**可能导致账号相关数据隐私泄露**。
  
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

### 使用前须知

使用本软件前，请先将仓库里 `config` 目录下的 `poolConfig` 目录 `ctrl + c/v` 到软件同目录的 `userdata` 目录下，以便于软件获取到终末地历史卡池信息。使用该软件也会检测并记录当前版本抽取过的卡池的数据信息，生成的 `json` 文件位于软件同级目录下。本项目也会持续维护该卡池信息文件，如有需要也可以自行下载覆盖替换。

> 注：如果维护不及时，可以提出 issue 或者 pr 申请更改对应卡池信息文件。

### 方式一：日志扫描 (Online Mode)

1. 启动《明日方舟：终末地》PC 客户端。
2. 打开游戏内的【寻访】界面，并点击一次【历史记录】。
   *   *注：如果您同时游玩官服和B服，请分别登录并打开一次历史记录。*
3. 打开本工具，点击 **[ ONLINE INITIALIZE ]**。
4. **服务器选择**:
   - 如果工具检测到单个账号，将自动同步。
   - 如果工具检测到**双端数据**，界面将弹出选择框，点击对应的服务器即可开始同步。

### 方式二：Web Token 同步 (推荐 / 支持多号)

1. 打开本工具，点击 **[ WEB TOKEN SYNC ]**。
2. 您有两种选择：
   - **推荐**: 点击 **[ CONNECT (OFFICIAL) ]**，在弹出的官方窗口中登录，软件将自动捕获凭证。
   - **手动**: 点击下方输入框，粘贴您手动获取的 Token，然后点击 **[ CONNECT (LOCAL) ]**。
3. 如果该账号下有多个角色（如官服/B服），界面会提示您选择目标角色。
### 方式三：查看本地历史 (Local Mode)
1. 直接打开本工具。
2. 点击 **[ LOCAL INITIALIZE ]**。
3. 如果本地同时存有双服存档，工具会提示您选择要加载的服务器档案。

### 方式四：导入临时 Json 文件

1. 直接打开本工具。
2. 点击 **[ IMPORT TEMP JSON ]**。
3. 选择需要导入的 Json 文件。

### **导出寻访报表 (Export Data)**
1. 在成功加载任意服务器的数据后（ONLINE 或 LOCAL 模式均可）。
2. 点击顶部导航栏的 **`[ EXPORT_EXCEL ]`** 指令。
3. 在系统弹窗中选择保存路径，工具将根据当前选择的服务器自动命名文件（如 `endfield_data_official.xlsx`）。

## 📂 目录结构 (Directory)

数据默认存储在用户配置目录下，可通过界面顶部的 `[ DATA_FOLDER ]` 按钮直接访问。文件名已更新以支持多服隔离（前提是使用短 Token 获取方式）：

```cmd
userdata/
├── uid_timeStamp/                      		  // [精准模式] 特定UID存档
│   ├── official_char_history.json    // 角色池记录
│   └── official_weapon_history.json  // 武器池记录
│   or
│   ├── bilibili_char_history.json    // 角色池记录
│   └── bilibili_weapon_history.json  // 武器池记录
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
git clone https://github.com/RoLingG/EndField_Gacha_App.git

# 进入目录
cd Endfield_Gacha_App

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

