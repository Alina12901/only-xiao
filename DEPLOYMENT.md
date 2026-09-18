# 森月居部署说明

本文按网页操作顺序编写。当前文档只做部署准备，不创建任何公开服务，不推送 GitHub，不产生费用。

部署前必须理解：

- GitHub 仓库一旦公开，代码和提交历史会对所有人可见。
- 前端平台部署后会产生公开网页地址。
- 后端平台部署后会产生公开 API 地址。
- 平台免费额度用完后通常需要绑定付款方式。
- 真正发送聊天消息会调用模型服务，可能产生模型费用。

## 第一步：GitHub

### 1. 本地确认

在 `G:\xiao` 运行：

```powershell
git status
git log --oneline --decorate
```

确认工作区没有未提交修改，且真实 `.env` 没有被跟踪。

### 2. 创建 GitHub 仓库

在 GitHub 网页：

1. 登录 GitHub。
2. 点击 `New repository`。
3. 填写仓库名称。
4. 私人使用建议选择 `Private`。
5. 不要勾选自动创建 README、`.gitignore` 或 License。
6. 点击创建。

公开性说明：

- `Private`：只有你和授权协作者能看到，推荐。
- `Public`：所有人可见，属于公开步骤，需要你确认。

### 3. 推送代码

GitHub 创建仓库后会显示远程地址。回到本地执行：

```powershell
cd G:\xiao
git remote add origin <GitHub仓库地址>
git branch -M main
git push -u origin main
```

这一步会把代码和 Git 历史上传到 GitHub。必须确认历史中没有真实密钥后再执行。

## 第二步：前端平台

可选用 Vercel、Netlify、Cloudflare Pages 等静态前端平台。

### 1. 连接 GitHub

在前端平台网页：

1. 注册或登录。
2. 选择 `Add New Project` 或 `Import Project`。
3. 授权平台读取你的 GitHub 仓库。
4. 选择森月居仓库。

授权仓库阅读权限属于需要你确认的操作。

### 2. 填写构建设置

根据平台界面填写：

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 3. 填写前端环境变量

只需要一个公开变量：

```text
VITE_API_BASE_URL
```

用途：

- 本地开发留空，使用 Vite 代理。
- 部署时填写后端公开 HTTPS 地址。
- 修改此值后必须重新构建或重新部署前端。

不要在 `VITE_API_BASE_URL` 中填写任何密钥。

### 4. 先部署前端

点击 `Deploy`。

结果：

- 会创建公开网页地址，属于公开步骤。
- 免费套餐可能有限额，超过后可能收费。
- 此时前端还无法正常调用后端，需要等后端部署完成。

## 第三步：后端平台

可选用 Render、Railway、Fly.io、云服务器 Node 环境等。前端静态平台不能直接运行 Express。

### 1. 创建 Web Service

在后端平台网页：

1. 登录。
2. 选择 `New Web Service` 或同类入口。
3. 连接 GitHub。
4. 选择同一个森月居仓库。

### 2. 填写构建和启动配置

```text
Root Directory: backend
Install Command: npm install
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

后端启动脚本已经支持：

- 读取平台提供的 `PORT`
- 生产环境默认监听 `0.0.0.0`
- 保留 `/api/health`

### 3. 填写后端环境变量

只填写变量名对应的真实值，不要把值写进 GitHub：

```text
PORT
HOST
FRONTEND_ORIGIN
AUTH_COOKIE_SECURE
AUTH_COOKIE_SAME_SITE
CREDENTIAL_ENCRYPTION_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
MODEL_BASE_URL
MODEL_API_KEY
MODEL_NAME
MODEL_SYSTEM_PROMPT_FILE
MODEL_MAX_TOKENS
MODEL_TEMPERATURE
```

推荐值说明：

- `PORT`：通常由平台自动提供，不要固定为本地端口。
- `HOST=0.0.0.0`：允许平台代理访问后端。
- `FRONTEND_ORIGIN=https://<你的前端域名>`：只允许真实前端来源，不要加结尾斜杠，多个来源用英文逗号分隔。
- `AUTH_COOKIE_SECURE=true`：HTTPS 环境必须开启。
- `AUTH_COOKIE_SAME_SITE`：
  - 前后端在同一站点或子域名下使用 `lax`。
  - 两个平台是完全不同站点时使用 `none`。
  - 使用 `none` 时必须同时设置 `AUTH_COOKIE_SECURE=true`。
- `MODEL_SYSTEM_PROMPT_FILE=config/system-prompt.txt`。
- 其他变量填你自己的真实配置。

### 4. 部署后端

点击 `Deploy`。

结果：

- 会创建公开 API 地址，属于公开步骤。
- 平台可能要求绑定付款方式，超出免费额度可能收费。
- 模型请求会产生模型费用。

### 5. 检查健康接口

部署成功后打开：

```text
https://<你的后端域名>/api/health
```

应看到 `status: "ok"`、`databaseConfigured: true`、`authRequired: true` 和 `memoryEnabled: false`。

## 第四步：连接前后端

### 1. 把后端地址写入前端

回到前端平台的环境变量页面：

```text
VITE_API_BASE_URL=https://<你的后端域名>
```

保存后重新部署前端。

### 2. 把前端地址写入后端

回到后端平台的环境变量页面：

```text
FRONTEND_ORIGIN=https://<你的前端域名>
```

保存并重启或重新部署后端。

如果前后端完全跨站，同时确认：

```text
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=none
```

## 第五步：最终验收

1. 打开前端公开地址。
2. 登录。
3. 新建会话。
4. 发送消息，确认消息立即显示。
5. 等待模型回复。
6. 刷新页面，确认消息仍然存在。
7. 检查重命名、历史切换和删除。
8. 打开设置，确认供应商和模型可以加载。
9. 确认浏览器不会出现 CORS 或 401 错误。
10. 确认后端健康检查正常。

第一次发送消息会调用模型服务，可能产生费用。

## 公开、收费和确认清单

### 会公开

- GitHub 推送，如果仓库设为 Public
- 前端平台生成的网页地址
- 后端平台生成的 API 地址
- `VITE_API_BASE_URL` 的后端地址
- `/api/health` 健康检查

### 可能收费

- 前端平台超过免费额度
- 后端平台超过免费额度
- 数据库或 Supabase 超出免费套餐
- 模型 API 调用
- 自定义域名或 SSL 增值服务

### 需要你确认

- 是否创建 GitHub 远程仓库
- 仓库设为 Private 还是 Public
- 是否授权平台读取 GitHub
- 是否绑定付款方式
- 是否部署公开网页和 API
- 是否发送真实模型测试消息
- 是否将 `SUPABASE_SECRET_KEY` 保留在后端平台

## 安全提醒

- 不要把 `.env` 上传到 GitHub。
- 不要把模型 API Key 写入前端环境变量。
- 不要把 Supabase Secret Key 写入前端。
- 不要把真实聊天内容放入日志。
- 不要在聊天窗口中发送完整 Key。
- 如果怀疑泄露，先去原平台撤销旧 Key，再生成新 Key。

