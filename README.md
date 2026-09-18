# 森月居

「森月居」是一个安静、清冷的私人 AI 聊天应用。AI 的名字是「枭」。

当前版本：v0.2.0，最小一问一答链路已完成。版本范围记录见 CHANGELOG.md。

当前为第二阶段：前端与后端完成一次最小的一问一答往返。后端只接收当前这一句话并返回固定占位回应。此时没有连接 AI 模型，没有数据库，没有长期记忆，也不会保存聊天记录。

## 当前功能

- 会话侧边栏
- 消息展示区
- 文本输入框与发送按钮
- 发送后，消息只临时显示在当前页面
- 单次问答链路，目前返回占位回应
- 等待回应状态
- 新建会话与切换会话
- 适配电脑和手机屏幕
- 后端健康检查接口

## 项目结构

```text
森月居/
├─ frontend/              React + Vite 前端
│  ├─ src/
│  │  ├─ App.jsx          页面与单次问答逻辑
│  │  ├─ App.css          页面视觉样式
│  │  ├─ index.css        全局基础样式
│  │  └─ main.jsx         前端入口
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ backend/               Node.js + Express 后端
│  ├─ src/server.js       后端入口
│  └─ package.json
├─ .gitignore
├─ CHANGELOG.md
└─ README.md
```

## 开始前准备

需要先安装 Node.js。建议使用 Node.js 20.19 或更高版本，当前开发环境已验证版本为：

```text
Node.js v24.20.0
npm 11.19.0
```

可以通过下面的命令确认：

```powershell
node --version
npm --version
```

## 启动方法

前端和后端需要分别在两个 PowerShell 窗口中运行。

### 第一个窗口：启动后端

```powershell
cd G:\xiao\backend
npm install
npm run dev
```

看到下面类似的提示即表示成功：

```text
森月居后端已启动：http://localhost:3000
```

浏览器访问 [http://localhost:3000/api/health](http://localhost:3000/api/health)，应看到 `status` 为 `ok`，并且 `modelConnected` 为 `false`。

### 第二个窗口：启动前端

保持后端窗口继续运行，再打开一个新的 PowerShell 窗口：

```powershell
cd G:\xiao\frontend
npm install
npm run dev
```

终端会显示本地访问地址，通常是：

[http://localhost:5173](http://localhost:5173)

如果 `5173` 端口已被占用，Vite 会自动选择另一个端口。此时请以终端实际显示的地址为准。

### 停止运行

在各自运行中的窗口按 `Ctrl + C`。

## 第二阶段验收方法

1. 打开前端地址后，页面标题和品牌名称显示为「森月居」。
2. 页面左侧能看到会话侧边栏；页面上有消息区、输入框和发送按钮。
3. 输入文字后发送，自己的消息会立即出现，随后会收到枭的占位回应。
4. 输入为空时，发送按钮不可用。
5. 可以点击「新建会话」，也可以切换已有会话。
6. 刷新页面后，新发送的临时消息会消失；这是预期行为。
7. 页面应明确显示尚未连接模型，当前回应只是用于验证一问一答链路。
8. 访问后端健康检查接口，确认后端可运行，并显示未连接模型和数据库。

## 本阶段明确不包含

- AI 模型调用
- API 密钥
- 用户登录或账号系统
- 数据库
- 长期记忆
- 云端部署
- 付费服务



