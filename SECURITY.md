# 森月居安全检查

检查日期：2026-09-18

## 检查范围

- 源代码
- Git 已跟踪文件
- Git 历史提交
- 前端生产构建产物
- 项目内日志
- 认证和业务接口
- Supabase RLS 与表权限
- 自定义第三方 API 地址处理
- 跨域和浏览器存储

## 可以公开

- 项目源代码
- `.env.example` 中的变量名称
- Supabase Publishable Key，前提是 RLS 和表权限正确
- 前端和后端的公开访问地址

## 绝不公开

- 模型 API Key
- Supabase Secret Key 或旧式 service_role Key
- 数据库密码和连接字符串
- 登录签名密钥
- 真实聊天记录
- CREDENTIAL_ENCRYPTION_KEY
- 具有后台权限的临时链接或令牌

## 当前结论

### 通过

- `backend/.env` 被 `.gitignore` 排除。
- `backend/.env` 没有被 Git 跟踪，也没有出现在 Git 历史中。
- Git 历史没有检测到真实 OpenAI、Supabase Secret 或 JWT 风格密钥。
- Git 历史中的非空 Assignments 报告来自 README 和 `.env.example` 的占位文字，不是实际密钥。
- 前端源码中没有后端密钥变量名。
- 前端没有使用 localStorage、sessionStorage 或 IndexedDB 保存访问令牌或供应商密钥。
- 前端构建产物没有检测到疑似密钥。
- 项目内日志没有检测到疑似密钥。
- 后端不会把供应商完整 API Key 返回前端。
- 后端日志不打印请求正文、密码或供应商响应正文。
- 会话、消息、设置和供应商接口均先验证登录用户。
- 业务查询写入 `owner_id` 时使用已验证用户 ID，不接受前端传入所有者 ID。
- `sessions`、`messages`、`settings` 和 `provider_credentials` 开启 RLS。
- RLS 策略限制用户只访问 `owner_id = auth.uid()` 的数据。
- `messages` 只开放读取和新增，未开放更新和直接删除。
- CORS 只允许 `FRONTEND_ORIGIN` 中列出的精确前端来源，不支持通配符。
- 自定义第三方地址只允许 HTTPS。
- 自定义第三方地址会阻止本机、内网、链路本地和保留地址。
- 自定义请求禁止 HTTP 重定向。
- 自定义地址在每次拉取模型和聊天前重新校验。

### 已修复

- 移除了代码中写死的私人兼容网关地址。现在网关地址只从后端环境变量读取。
- 增加了自定义第三方地址在每次使用前的重新校验，避免数据库中的地址被修改后绕过初次连接检查。

### 需要确认

- 当前本地开发使用 AUTH_COOKIE_SECURE=false。正式 HTTPS 部署必须改为 	rue。
- 本地 Cookie 使用 AUTH_COOKIE_SAME_SITE=lax。前后端部署在完全不同的站点时，应改为
one 并同时启用 Secure。
- `SUPABASE_SECRET_KEY` 当前只用于检查配置是否填写，不参与普通业务请求。若后续确认不需要管理级操作，可以从后端环境中移除，以减少高权限凭据暴露面。
- 当前没有接口限流。本机单用户使用可以接受；公开部署前应增加登录、聊天和供应商连接限流。
- 当前没有独立 CSRF Token。SameSite Cookie、精确 CORS 白名单和同源代理降低了风险；公开部署前仍应复核。
- 自定义第三方地址虽然禁止内网和重定向，但公网 DNS 仍存在理论上的 DNS Rebinding 窗口。公开部署时应通过出站代理或网络层白名单进一步限制。
- Supabase Dashboard 管理员可以看到加密凭据行，但看不到明文 API Key。

### 必须修复

当前检查没有发现必须立即修复的已知问题。

## 上线前复查

1. 确认 `backend/.env` 仍被 Git 忽略。
2. 确认 Git 历史中没有真实密钥。
3. 确认前端构建目录没有被提交。
4. 确认 Supabase RLS 已启用且策略仍为所有者隔离。
5. 确认供应商 Table 没有允许 `anon` 访问。
6. 确认生产环境使用 HTTPS。
7. 确认 `AUTH_COOKIE_SECURE=true`。
8. 确认 CORS 只允许真实前端域名，且没有 `*`。
9. 确认日志不会打印请求正文、密码、Token 或供应商完整响应。
10. 确认模型、Supabase 和加密密钥可以独立轮换。

## 如果怀疑密钥泄露

1. 立即在原平台撤销旧 Key。
2. 重新生成新 Key。
3. 只把新 Key 写入后端 `.env` 或通过设置页重新连接。
4. 清理可能包含密钥的日志、截图和构建产物。
5. 不要只删除当前文件，因为旧值可能仍存在于 Git 历史、备份或缓存中。
