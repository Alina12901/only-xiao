# 森月居

「森月居」是一个安静、清冷的私人 AI 聊天应用。AI 的名字是「枭」。

当前版本：v0.6.0，已经加入官方模型供应商适配与加密密钥存储。

版本范围记录见 `CHANGELOG.md`。

## 当前范围

已完成：

- React + Vite 前端
- Node.js + Express 后端
- 单用户 Supabase Auth 登录
- sessions、messages 与 settings 三张业务表
- 设置页可修改系统提示词、默认模型、最大回复长度和温度
- 支持 OpenAI、Anthropic、DeepSeek 官方 API
- 支持输入供应商 API Key、测试连接并拉取模型列表
- 供应商 API Key 加密后保存，前端不会回显
- 会话和消息均由后端读写
- 应用打开时加载会话列表
- 新建会话、切换会话并加载历史
- 使用应用内对话框重命名会话
- 删除前二次确认，删除后自动切换或回到欢迎页
- 用户消息发送后立即显示
- 随后异步等待枭的回复
- 等待期间锁定输入和发送按钮，避免重复请求
- 回复失败后恢复原输入，可直接重试
- 新消息出现时自动滚动到合适位置
- 长消息、分段文字和代码可以自动换行
- Supabase RLS 所有者隔离
- 前端只在内存中保存访问令牌
- 后端 API Key 与 Supabase Secret Key 不进入前端
- Claude 单次问答
- 最大回复长度限制
- 用户设置由 RLS 按所有者隔离

明确不包含：

- 记忆压缩
- 长期记忆摘要
- 多模型切换
- 多用户注册
- 云端部署

## 项目结构

```text
森月居/
├─ frontend/                 React + Vite 前端
│  ├─ src/
│  │  ├─ App.jsx             登录、会话、消息和问答逻辑
│  │  ├─ App.css             页面视觉样式
│  │  ├─ index.css           全局基础样式
│  │  └─ main.jsx            前端入口
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ backend/                  Node.js + Express 后端
│  ├─ src/server.js          认证、聊天和持久化接口
│  ├─ src/providers.js       官方模型供应商适配层
│  ├─ src/credentials.js     供应商密钥加密与读取
│  ├─ config/
│  │  └─ system-prompt.txt   仅后端读取的系统提示词
│  ├─ .env.example           环境变量模板，不含真实值
│  ├─ .env                   本机真实配置，不进入 Git
│  └─ package.json
├─ supabase/
│  └─ migrations/
│     ├─ 202609180001_create_sessions_and_messages.sql
│     ├─ 202609180002_create_settings.sql
│     └─ 202609180003_add_multi_provider.sql
├─ .gitignore
├─ CHANGELOG.md
└─ README.md
```

## 数据表

### `sessions`

每个会话包含唯一 `id`、所有者 `owner_id`、标题、创建时间和更新时间。

### `messages`

每条消息包含唯一 `id`、所属 `session_id`、所有者 `owner_id`、角色、正文和创建时间。

删除会话时，数据库会自动删除该会话下的所有消息。

### `settings`

每个用户最多一行设置，包含系统提示词、默认模型名称、最大回复长度、温度和更新时间。

### `provider_credentials`

保存用户输入的官方供应商 API Key，只存加密结果、随机向量和校验值。前端不能读取完整 Key。

## Supabase 首次设置

### 第一步：创建项目

在 Supabase 后台创建一个项目。不要使用“秘密网址”作为保护方式。

### 第二步：执行迁移

打开 Supabase Dashboard 的 SQL Editor，将下面文件中的全部内容复制进去并执行：

```text
G:\xiao\supabase\migrations\202609180001_create_sessions_and_messages.sql
G:\xiao\supabase\migrations\202609180002_create_settings.sql
G:\xiao\supabase\migrations\202609180003_add_multi_provider.sql
```

迁移会创建：

- `public.sessions`
- `public.messages`
- `public.settings`
- `public.provider_credentials`
- 必要索引
- RLS 策略
- `authenticated` 角色的最小表权限

### 第三步：创建唯一用户

打开 Supabase Dashboard 的 Authentication：

1. 创建一个你自己的邮箱和密码用户。
2. 关闭公开注册。
3. 不创建额外的用户资料表。

### 第四步：填写后端环境变量

打开：

```text
G:\xiao\backend\.env
```

填写：

```env
CREDENTIAL_ENCRYPTION_KEY=后端加密主密钥
SUPABASE_URL=你的项目地址
SUPABASE_PUBLISHABLE_KEY=你的可公开 Key
SUPABASE_SECRET_KEY=你的 Secret Key
MODEL_TEMPERATURE=1
AUTH_COOKIE_SECURE=false
```

说明：

- `CREDENTIAL_ENCRYPTION_KEY`：后端生成和保存的加密主密钥，用于加密供应商 API Key。
- `SUPABASE_URL`：Supabase 项目地址。
- `SUPABASE_PUBLISHABLE_KEY`：用于后端完成登录验证，属于可公开 Key，但仍然只放在后端。
- `SUPABASE_SECRET_KEY`：高权限钥匙，只放后端环境变量。
- `MODEL_TEMPERATURE`：后端默认温度，当前按 Claude 接口使用 `0` 到 `1`。
- `AUTH_COOKIE_SECURE`：本地 HTTP 使用 `false`；部署到 HTTPS 后改为 `true`。

不要把 Secret Key 发到聊天中，不要写入前端，不要提交到 Git。

## 权限设计

- 浏览器只调用森月居后端。
- 浏览器不直接读取 `sessions`、`messages`、`settings` 或 `provider_credentials`。
- Supabase RLS 已开启。
- 未登录用户没有表权限。
- 登录用户只能访问 `owner_id` 等于自己用户 ID 的行。
- `owner_id` 只能由后端从已验证的访问令牌中读取。
- 普通会话和消息请求使用用户令牌，由 RLS 限制权限。
- Secret Key 不参与普通聊天请求。
- `messages` 只允许读取和新增；删除会话时由数据库级联删除消息。
- `settings` 每个用户最多一行，只能读取和修改自己的设置。
- `provider_credentials` 只保存加密后的供应商 API Key，后端不回传完整 Key。
- 数据库没有记忆压缩逻辑，也不保存长期摘要。

## 启动方法

前端和后端分别运行在两个 PowerShell 窗口中。

### 后端

```powershell
cd G:\xiao\backend
npm install
npm run dev
```

后端会读取 `backend/.env`，但不会输出 Key。

### 前端

```powershell
cd G:\xiao\frontend
npm install
npm run dev
```

浏览器访问：

[http://localhost:5173](http://localhost:5173)

## 健康检查

访问：

[http://localhost:3000/api/health](http://localhost:3000/api/health)

关键字段：

- `status`: 应为 `ok`
- `modelConfigured`: 模型环境变量完整时应为 `true`
- `databaseConfigured`: Supabase 后端变量完整时应为 `true`
- `secretKeyConfigured`: Secret Key 已填写时应为 `true`
- `authRequired`: 应为 `true`
- `multiProvider`: 应为 `true`
- `credentialEncryptionConfigured`: 应为 `true`
- `memoryEnabled`: 应为 `false`

健康检查不会发起模型请求，也不会产生模型费用。

## 持久化验收

1. 打开 [http://localhost:5173](http://localhost:5173)。
2. 使用 Supabase 中创建的唯一账号登录。
3. 点击“新建会话”，确认左侧出现新会话。
4. 发送一条测试消息，确认枭回复。
5. 刷新页面，确认会话和两条消息仍然存在。
6. 点击另一个会话，再点击回来，确认历史消息正确加载。
7. 删除该会话，确认左侧会话消失。
8. 再刷新页面，确认被删除的会话没有恢复。
9. 在设置页连接一个官方供应商，确认能够拉取模型列表。
10. 选择允许列表中的模型并保存，刷新确认设置仍保留。
11. 确认页面和数据库中没有记忆压缩或长期摘要。

第一次发送消息会调用模型服务，是否产生费用取决于你的模型平台和账户方案。
