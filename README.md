# 森月居

「森月居」是一个安静、清冷的私人 AI 聊天应用。AI 的名字是「枭」。

当前版本：v0.3.0，已接入 OpenAI 兼容模型接口的最小单次问答链路。真实模型配置需要由使用者本人填写在 `backend/.env` 中。

版本范围记录见 `CHANGELOG.md`。

## 当前范围

已完成：

- React + Vite 前端
- Node.js + Express 后端
- 会话侧边栏、消息区、输入框和发送按钮
- 浅灰蓝与蓝粉渐变视觉
- AI 头像预留自定义入口
- 「森月居」标题优先使用 Huiwen-MinchoGBK 字体
- `GET /api/health` 健康检查接口
- `POST /api/chat` 单次聊天接口
- 后端读取环境变量并调用 OpenAI 兼容的 Claude 接口
- 通过完整模型 ID 选择 Claude Thinking 模型
- 每次只发送当前这一句话
- 后端只返回一次文本回复

明确不包含：

- 数据库
- 长期记忆
- 多轮上下文
- 多模型切换
- 用户登录或账号系统
- 云端部署
- 前端保存 API Key

## 项目结构

```text
森月居/
├─ frontend/                 React + Vite 前端
│  ├─ src/
│  │  ├─ App.jsx             页面与单次问答逻辑
│  │  ├─ App.css             页面视觉样式
│  │  ├─ index.css           全局基础样式
│  │  └─ main.jsx            前端入口
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ backend/                  Node.js + Express 后端
│  ├─ src/server.js          聊天接口与健康检查
│  ├─ .env.example           环境变量模板，不含真实值
│  ├─ .env                   本机真实配置，不进入 Git
│  ├─ config/
│  │  └─ system-prompt.txt   仅后端读取的系统提示词
│  └─ package.json
├─ .gitignore
├─ CHANGELOG.md
└─ README.md
```

## 开始前准备

建议使用 Node.js 20.19 或更高版本。当前开发环境已验证：

```text
Node.js v24.20.0
npm 11.19.0
```

## 填写模型配置

真实密钥只能填写在：

```text
G:\xiao\backend\.env
```

可以用记事本打开：

```powershell
notepad G:\xiao\backend\.env
```

需要填写以下变量：

```env
PORT=3000
MODEL_BASE_URL=
MODEL_NAME=
MODEL_SYSTEM_PROMPT_FILE=config/system-prompt.txt
MODEL_MAX_TOKENS=256
MODEL_API_KEY=
```

- `PORT`：后端端口，默认 `3000`。
- `MODEL_BASE_URL`：填写模型平台给出的 OpenAI 兼容 API 基础地址，通常以 `/v1` 结尾。
- `MODEL_NAME`：填写平台显示的完整模型 ID，不要只填写界面展示名称。当前使用 `anthropic/claude-opus-4-6-thinking` 这类由平台提供的 ID。
- `MODEL_SYSTEM_PROMPT_FILE`：系统提示词文件的路径。完整提示词保存在后端配置文件中，前端不会获得。
- `MODEL_MAX_TOKENS`：单次最大回复长度，当前为 `256`；后端会强制限制在 `1` 到 `512`。
- `MODEL_API_KEY`：填写你自己的模型 API Key。

安全要求：

- 不要把 API Key 发到聊天中。
- 不要把 API Key 写入 React 前端。
- 不要使用 `VITE_` 前缀保存 API Key。
- 不要把 API Key 写入源代码、日志或 Git。
- `backend/.env` 已由 `.gitignore` 排除。

## 启动方法

前端和后端需要分别在两个 PowerShell 窗口中运行。

### 第一个窗口：启动后端

```powershell
cd G:\xiao\backend
npm install
npm run dev
```

后端会读取 `backend/.env`，但不会把 Key 输出到终端。

### 第二个窗口：启动前端

```powershell
cd G:\xiao\frontend
npm install
npm run dev
```

浏览器打开：

[http://localhost:5173](http://localhost:5173)

## 检查后端

健康检查：

[http://localhost:3000/api/health](http://localhost:3000/api/health)

关键字段：

- `status`: 应为 `ok`。
- `modelConfigured`: 环境变量填写完整后应为 `true`。
- `databaseConnected`: 应为 `false`。
- `memoryEnabled`: 应为 `false`。

健康检查不会调用模型，因此不会产生模型费用。

## 发送第一条测试消息

1. 确认后端终端显示“模型配置：已就绪”。
2. 打开 [http://localhost:5173](http://localhost:5173)。
3. 在输入框输入简单问题，例如：`你好，请用一句话介绍你自己。`
4. 点击发送或按 Enter。
5. 前端只把这一句话发送到 `POST /api/chat`。
6. 后端调用所选模型，并把文本回复返回页面。

第一次真正发送消息会调用模型服务，是否产生费用取决于你的模型平台和账户方案。

## 停止运行

在前后端终端窗口中分别按 `Ctrl + C`。


