# 森月居

## 项目是什么

森月居是一个私人 AI 聊天应用，AI 角色名称是「枭」。

当前版本支持：

- 单用户登录
- 会话和消息持久化
- 会话重命名、切换和删除
- 单次问答
- OpenAI、Anthropic、DeepSeek 官方 API
- 一个可随时重配的自定义第三方 API
- 从供应商拉取模型并选择默认模型
- 后端加密保存供应商 API Key

当前版本：v0.8.1。详细版本记录见 `CHANGELOG.md`。

## 目录位置

项目根目录：

```text
G:\xiao
```

前端目录：

```text
G:\xiao\frontend
```

后端目录：

```text
G:\xiao\backend
```

数据库迁移目录：

```text
G:\xiao\supabase\migrations
```

主要文件：

```text
G:\xiao
├─ frontend/
│  ├─ src/App.jsx             前端页面和交互
│  ├─ src/App.css             前端样式
│  ├─ vite.config.js          前端配置
│  ├─ .env.example           前端公开环境变量模板
│  ├─ index.html             前端页面入口
│  └─ package.json
├─ backend/
│  ├─ src/server.js           后端接口和认证
│  ├─ src/providers.js        模型供应商适配层
│  ├─ src/credentials.js      密钥加密和读取
│  ├─ config/system-prompt.txt 默认系统提示词
│  ├─ .env.example            环境变量模板
│  ├─ .env                    本机真实配置，不进入 Git
│  └─ package.json
├─ supabase/migrations/       Supabase 数据库迁移
├─ SECURITY.md
├─ DEPLOYMENT.md
├─ CHANGELOG.md
└─ README.md
```

## 环境变量名称

后端真实值只能写入：

```text
G:\xiao\backend\.env
```

前端只允许公开配置，使用：

```text
G:\xiao\frontend\.env
```

不要提交真实后端 `.env`，不要把真实值发到聊天中。

### 后端环境变量

| 变量名 | 用途 |
|---|---|
| `PORT` | 平台提供的后端端口；本地默认 3000 |
| `HOST` | 监听地址；本地可用 `127.0.0.1`，部署通常使用 `0.0.0.0` |
| `FRONTEND_ORIGIN` | 允许访问后端的前端公开地址，多个地址用英文逗号分隔 |
| `MODEL_BASE_URL` | 当前兼容网关基础地址 |
| `MODEL_API_KEY` | 当前兼容网关密钥 |
| `MODEL_NAME` | 当前兼容网关默认模型 ID |
| `MODEL_SYSTEM_PROMPT_FILE` | 默认系统提示词文件路径 |
| `MODEL_MAX_TOKENS` | 默认最大回复长度 |
| `MODEL_TEMPERATURE` | 默认温度 |
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase 可公开 Key，仅由后端读取 |
| `SUPABASE_SECRET_KEY` | Supabase Secret/Secret Key，仅由后端读取 |
| `AUTH_COOKIE_SECURE` | 本地使用 `false`，HTTPS 部署使用 `true` |
| `AUTH_COOKIE_SAME_SITE` | 本地或同站使用 `lax`；完全跨站使用 `none` |
| `CREDENTIAL_ENCRYPTION_KEY` | 加密用户填写的供应商 API Key |

### 前端环境变量

| 变量名 | 用途 |
|---|---|
| `VITE_API_BASE_URL` | 后端公开地址；本地留空使用 Vite 代理，部署时填写后端 HTTPS 地址 |

前端变量会进入公开构建产物，只能填写公开信息，绝对不能放 API Key。

环境变量模板文件：

```text
G:\xiao\backend\.env.example
G:\xiao\frontend\.env.example
```

模板中不包含真实值。
## 数据库初始化

### 第一步：创建 Supabase 项目

在 Supabase 官方后台创建项目，并创建你自己的唯一登录用户。

不要使用“秘密网址”作为保护方式。访问权限由 Supabase Auth、RLS 和后端共同控制。

### 第二步：依次执行迁移

打开 Supabase Dashboard 的 SQL Editor，按文件编号顺序复制每个文件的全部内容并执行。

```text
G:\xiao\supabase\migrations\202609180001_create_sessions_and_messages.sql
G:\xiao\supabase\migrations\202609180002_create_settings.sql
G:\xiao\supabase\migrations\202609180003_add_multi_provider.sql
G:\xiao\supabase\migrations\202609180004_add_custom_provider_fields.sql
```

注意：要把文件内容复制进 SQL Editor，不要把文件路径直接粘贴进去。

迁移完成后会建立：

- `public.sessions`
- `public.messages`
- `public.settings`
- `public.provider_credentials`
- 必要索引
- RLS 策略
- `authenticated` 角色的最小表权限

### 第三步：关闭公开注册

进入 `Authentication` → `Users` 创建唯一用户，然后关闭新用户注册。

已有用户仍可以登录，但陌生邮箱不能创建新账号。

## 本地启动

前端和后端需要分别在两个 PowerShell 窗口中运行。

### 窗口一：后端

```powershell
cd G:\xiao\backend
npm install
npm run dev
```

正常情况下会显示：

```text
森月居后端已启动：http://localhost:3000
模型配置：已就绪
数据库配置：已就绪
```

后端只监听本机地址，并自动读取 `G:\xiao\backend\.env`。

### 窗口二：前端

```powershell
cd G:\xiao\frontend
npm install
npm run dev
```

浏览器打开：

[http://localhost:5173](http://localhost:5173)

Vite 如果发现 `5173` 端口被占用，会改用其他端口，以终端实际地址为准。

## 怎样运行检查

### 1. 健康检查

浏览器打开：

[http://localhost:3000/api/health](http://localhost:3000/api/health)

重要字段：

- `status` 应为 `ok`
- `modelConfigured` 应为 `true`
- `databaseConfigured` 应为 `true`
- `secretKeyConfigured` 应为 `true`
- `authRequired` 应为 `true`
- `multiProvider` 应为 `true`
- `credentialEncryptionConfigured` 应为 `true`
- `memoryEnabled` 应为 `false`

也可以在 PowerShell 中运行：

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

健康检查不会调用聊天模型，也不会产生模型费用。

### 2. 后端语法检查

```powershell
cd G:\xiao\backend
node --check src/server.js
node --check src/providers.js
node --check src/credentials.js
```

三个命令都应没有报错。

### 3. 前端构建检查

```powershell
cd G:\xiao\frontend
npm run build
```

看到 `✓ built` 表示构建通过。

### 4. 手动验收

1. 打开前端并登录。
2. 新建会话。
3. 发送消息，确认自己的消息立即出现。
4. 等待枭的回复。
5. 刷新页面，确认会话和消息还在。
6. 重命名会话并刷新，确认名称保留。
7. 删除会话，确认有二次确认，删除后自动切换或回到欢迎页。
8. 进入设置页，连接供应商并拉取模型。
9. 选择模型并保存，刷新后确认设置保留。
10. 确认第一句话被保存和加载，但第二轮请求没有携带长期历史记忆。

第一次真正发送消息会调用模型服务，可能产生费用。

## 当前已经完成

- React + Vite 前端
- Node.js + Express 后端
- 清冷浅灰蓝、蓝粉渐变的界面
- Watercolor Glass 玻璃材质 tokens
- 输入区独立玻璃层、内外高光与 blur/saturate
- 单用户登录
- 会话列表、自动加载和历史切换
- 新建、重命名和删除会话
- 删除前二次确认
- 用户消息立即显示
- 等待期间禁止重复提交
- 失败后恢复输入并允许重试
- 模型回复保存成功后才结束加载
- 自动滚动和长文本换行
- Supabase `sessions`、`messages` 和 `settings` 表
- Supabase `provider_credentials` 加密凭据表
- RLS 所有者隔离
- 默认系统提示词、模型、最大回复长度和温度设置
- OpenAI、Anthropic、DeepSeek 官方适配器
- 一个自定义第三方 API 地址
- 自定义 OpenAI 兼容和 Anthropic 兼容格式
- 官方模型列表拉取和选择
- 供应商 API Key 使用 AES-256-GCM 加密
- 自定义地址只允许 HTTPS 公网地址
- 阻止本机、内网、保留地址和重定向

## 还没有完成

- 流式输出
- 长期记忆
- 记忆压缩
- 多轮历史上下文
- 多个自定义第三方地址同时保存
- 多模型自动降级或负载均衡
- 文件、语音、图片识别
- 云端部署
- 多用户开放注册
- 自动备份和恢复

部署顺序、公开步骤和收费提示见 `DEPLOYMENT.md`。

## 安全约定

完整安全检查记录见 `SECURITY.md`。
- 真实 `.env` 不进入 Git。
- Supabase Secret Key 只放后端。
- 模型供应商密钥只放后端 `backend/.env` 或加密后的 `provider_credentials`。
- 前端不能读取完整供应商 Key。
- 前端不能直接读取业务表。
- 前端不能提交任意请求路径，只能提交通过后端允许的供应商和模型 ID。
- 自定义第三方地址会做 HTTPS 和公网地址检查。
- 删除会话会删除该会话的全部消息。
