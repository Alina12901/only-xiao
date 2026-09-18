import { lookup } from 'node:dns/promises'
import { readFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  deleteProviderCredential,
  getProviderCredential,
  isCredentialEncryptionConfigured,
  listStoredProviderRecords,
  saveProviderCredential,
} from './credentials.js'
import {
  getProviderCatalog,
  getProviderDefinition,
  listProviderModels,
  requestProviderReply,
} from './providers.js'
import express from 'express'

const app = express()
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT) || 3000

const modelApiKey = process.env.MODEL_API_KEY?.trim() ?? ''
const modelBaseUrl = (process.env.MODEL_BASE_URL?.trim() ?? '').replace(/\/+$/, '')
const modelName = process.env.MODEL_NAME?.trim() ?? ''
const modelSystemPromptFile =
  process.env.MODEL_SYSTEM_PROMPT_FILE?.trim() || 'config/system-prompt.txt'
const configuredMaxTokens = Number.parseInt(
  process.env.MODEL_MAX_TOKENS ?? '256',
  10,
)
const modelMaxTokens = Number.isFinite(configuredMaxTokens)
  ? Math.min(Math.max(configuredMaxTokens, 1), 512)
  : 256
const configuredTemperature = Number.parseFloat(
  process.env.MODEL_TEMPERATURE ?? '1',
)
const modelTemperature =
  Number.isFinite(configuredTemperature) &&
  configuredTemperature >= 0 &&
  configuredTemperature <= 1
    ? configuredTemperature
    : 1

const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? ''
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? ''
const databaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)
const authCookieName = 'senyueju_refresh_token'
const authCookiePath = '/api/auth'
const authCookieSecure = process.env.AUTH_COOKIE_SECURE === 'true'

let modelSystemPrompt = ''

try {
  modelSystemPrompt = readFileSync(
    resolve(backendRoot, modelSystemPromptFile),
    'utf8',
  ).trim()
} catch (_error) {
  console.error('系统提示词文件无法读取')
}

const modelEndpoint = modelBaseUrl
  ? `${modelBaseUrl}${modelBaseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`
  : ''
const isModelConfigured = Boolean(
  modelApiKey && modelEndpoint && modelName && modelSystemPrompt,
)

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

function sendDatabaseConfigError(response) {
  response.status(503).json({
    error: '数据库尚未配置，请检查后端 Supabase 环境变量。',
  })
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=')

    if (separator < 0) {
      return cookies
    }

    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()

    try {
      cookies[name] = decodeURIComponent(value)
    } catch (_error) {
      cookies[name] = value
    }

    return cookies
  }, {})
}

function getRefreshToken(request) {
  return parseCookies(request.headers.cookie)[authCookieName] ?? ''
}

function setRefreshCookie(response, refreshToken) {
  response.cookie(authCookieName, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: authCookieSecure,
    path: authCookiePath,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(response) {
  response.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: authCookieSecure,
    path: authCookiePath,
  })
}

function createAuthClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function createUserClient(accessToken) {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

async function requireUser(request, response, next) {
  if (!databaseConfigured) {
    sendDatabaseConfigError(response)
    return
  }

  const authorization = request.get('authorization') ?? ''

  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({
      error: '登录状态已失效，请重新登录。',
    })
    return
  }

  const accessToken = authorization.slice('Bearer '.length).trim()

  if (!accessToken) {
    response.status(401).json({
      error: '登录状态已失效，请重新登录。',
    })
    return
  }

  try {
    const client = createUserClient(accessToken)
    const { data, error } = await client.auth.getUser(accessToken)

    if (error || !data.user) {
      response.status(401).json({
        error: '登录状态已失效，请重新登录。',
      })
      return
    }

    request.user = {
      id: data.user.id,
      email: data.user.email,
    }
    request.db = client
    next()
  } catch (_error) {
    response.status(503).json({
      error: '认证服务暂时不可用，请稍后重试。',
    })
  }
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number)

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true
  }

  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

function isPrivateAddress(address) {
  const normalized = address.toLowerCase()
  const family = isIP(normalized)

  if (family === 4) {
    return isPrivateIpv4(normalized)
  }

  if (family === 6) {
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true
    }

    if (normalized.startsWith('::ffff:')) {
      return isPrivateIpv4(normalized.slice('::ffff:'.length))
    }

    return false
  }

  return true
}

async function validateCustomBaseUrl(rawBaseUrl) {
  let url

  try {
    url = new URL(rawBaseUrl)
  } catch (_error) {
    throw new Error('接口地址格式不正确')
  }

  if (url.protocol !== 'https:') {
    throw new Error('自定义接口地址必须使用 HTTPS')
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('接口地址不能包含账号、查询参数或片段')
  }

  const hostname = url.hostname.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('接口地址不能指向本机或局域网')
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true })

  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error('接口地址不能指向内网或保留地址')
  }

  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/+$/, '')
}
async function getOwnedSession(client, sessionId, ownerId) {
  const { data, error } = await client
    .from('sessions')
    .select('id, title, created_at, updated_at')
    .eq('id', sessionId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) {
    return { error }
  }

  return { session: data }
}

function mapSettings(row) {
  return {
    provider: row.provider || 'gateway',
    systemPrompt: row.system_prompt,
    modelName: row.model_name,
    maxReplyTokens: row.max_reply_tokens,
    temperature: Number(row.temperature),
    updatedAt: row.updated_at,
  }
}

function getDefaultSettings() {
  return {
    provider: 'gateway',
    systemPrompt: modelSystemPrompt,
    modelName,
    maxReplyTokens: modelMaxTokens,
    temperature: modelTemperature,
  }
}

function isMissingProviderSchema(error) {
  return error?.code === '42703' && (error?.message ?? '').includes('provider')
}

function isMissingProviderCredentialsTable(error) {
  const message = error?.message ?? ''
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('public.provider_credentials')
  )
}
function isMissingSettingsTable(error) {
  const message = error?.message ?? ''
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('public.settings')
  )
}

async function getOrCreateUserSettings(client, userId) {
  const { data, error } = await client
    .from('settings')
    .select(
      'provider, system_prompt, model_name, max_reply_tokens, temperature, updated_at',
    )
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingSettingsTable(error) || isMissingProviderSchema(error)) {
      return {
        settings: getDefaultSettings(),
        persisted: false,
      }
    }

    return { error }
  }

  if (data) {
    return {
      settings: mapSettings(data),
      persisted: true,
    }
  }

  const defaults = getDefaultSettings()
  const { data: created, error: createError } = await client
    .from('settings')
    .insert({
      owner_id: userId,
      provider: defaults.provider,
      system_prompt: defaults.systemPrompt,
      model_name: defaults.modelName,
      max_reply_tokens: defaults.maxReplyTokens,
      temperature: defaults.temperature,
    })
    .select(
      'provider, system_prompt, model_name, max_reply_tokens, temperature, updated_at',
    )
    .single()

  if (createError) {
    if (isMissingSettingsTable(createError) || isMissingProviderSchema(createError)) {
      return {
        settings: defaults,
        persisted: false,
      }
    }

    if (createError.code === '23505') {
      const { data: existing, error: existingError } = await client
        .from('settings')
        .select(
          'provider, system_prompt, model_name, max_reply_tokens, temperature, updated_at',
        )
        .eq('owner_id', userId)
        .maybeSingle()

      if (existingError) {
        return { error: existingError }
      }

      if (existing) {
        return {
          settings: mapSettings(existing),
          persisted: true,
        }
      }
    }

    return { error: createError }
  }

  return {
    settings: mapSettings(created),
    persisted: true,
  }
}
app.get('/', (_request, response) => {
  response.json({
    app: '森月居',
    ai: '枭',
    message: '后端服务正在运行。',
  })
})

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    app: '森月居',
    ai: '枭',
    phase: '第四阶段：用户设置',
    provider: 'openai-compatible',
    modelConfigured: isModelConfigured,
    modelNameConfigured: Boolean(modelName),
    promptConfigured: Boolean(modelSystemPrompt),
    maxReplyTokens: modelMaxTokens,
    databaseConfigured,
    secretKeyConfigured: Boolean(supabaseSecretKey),
    authRequired: true,
    multiProvider: true,
    credentialEncryptionConfigured: isCredentialEncryptionConfigured(),
    memoryEnabled: false,
  })
})

app.post('/api/auth/login', async (request, response) => {
  if (!databaseConfigured) {
    sendDatabaseConfigError(response)
    return
  }

  const email =
    typeof request.body?.email === 'string' ? request.body.email.trim() : ''
  const password =
    typeof request.body?.password === 'string' ? request.body.password : ''

  if (!email || !password) {
    response.status(400).json({
      error: '请输入邮箱和密码。',
    })
    return
  }

  try {
    const client = createAuthClient()
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session || !data.user) {
      response.status(401).json({
        error: '邮箱或密码不正确。',
      })
      return
    }

    setRefreshCookie(response, data.session.refresh_token)
    response.json({
      accessToken: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (_error) {
    response.status(503).json({
      error: '认证服务暂时不可用，请稍后重试。',
    })
  }
})

app.post('/api/auth/refresh', async (request, response) => {
  if (!databaseConfigured) {
    sendDatabaseConfigError(response)
    return
  }

  const refreshToken = getRefreshToken(request)

  if (!refreshToken) {
    response.status(401).json({
      error: '登录状态已失效，请重新登录。',
    })
    return
  }

  try {
    const client = createAuthClient()
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session || !data.user) {
      clearRefreshCookie(response)
      response.status(401).json({
        error: '登录状态已失效，请重新登录。',
      })
      return
    }

    setRefreshCookie(response, data.session.refresh_token)
    response.json({
      accessToken: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (_error) {
    response.status(503).json({
      error: '认证服务暂时不可用，请稍后重试。',
    })
  }
})

app.post('/api/auth/logout', (_request, response) => {
  clearRefreshCookie(response)
  response.status(204).end()
})

app.get('/api/providers', requireUser, async (request, response) => {
  const catalog = getProviderCatalog()
  let storedRecords = []

  if (
    catalog.some((provider) => provider.credentialSource === 'stored')
  ) {
    const result = await listStoredProviderRecords(
      request.db,
      request.user.id,
    )

    if (result.error && !isMissingProviderCredentialsTable(result.error)) {
      console.error(`读取供应商状态失败：${result.error.code ?? 'unknown'}`)
      response.status(500).json({
        error: '供应商状态暂时无法读取，请稍后重试。',
      })
      return
    }

    storedRecords = result.records ?? []
  }

  const customRecord = storedRecords.find(
    (record) => record.provider === 'custom',
  )

  response.json({
    providers: catalog.map((provider) => {
      const connected =
        provider.credentialSource === 'environment'
          ? Boolean(modelApiKey && modelEndpoint)
          : storedRecords.some((record) => record.provider === provider.id)

      if (provider.id === 'custom') {
        return {
          ...provider,
          label: customRecord?.label || provider.label,
          connected,
          baseUrl: customRecord?.base_url || '',
          adapter: customRecord?.adapter || '',
        }
      }

      return {
        ...provider,
        connected,
      }
    }),
  })
})

app.post(
  '/api/providers/custom/connect',
  requireUser,
  async (request, response) => {
    if (!isCredentialEncryptionConfigured()) {
      response.status(503).json({
        error: '后端凭据加密尚未配置。',
      })
      return
    }

    const label =
      typeof request.body?.label === 'string'
        ? request.body.label.trim()
        : '自定义第三方 API'
    const rawBaseUrl =
      typeof request.body?.baseUrl === 'string'
        ? request.body.baseUrl.trim()
        : ''
    const adapter =
      typeof request.body?.adapter === 'string'
        ? request.body.adapter.trim()
        : ''
    const apiKey =
      typeof request.body?.apiKey === 'string'
        ? request.body.apiKey.trim()
        : ''

    if (!label || label.length > 80) {
      response.status(400).json({
        error: '自定义供应商名称必须为 1 到 80 个字符。',
      })
      return
    }

    if (!['openai-chat', 'anthropic-messages'].includes(adapter)) {
      response.status(400).json({
        error: '请选择支持的接口格式。',
      })
      return
    }

    if (!apiKey) {
      response.status(400).json({
        error: '请输入第三方 API Key。',
      })
      return
    }

    let baseUrl = ''

    try {
      baseUrl = await validateCustomBaseUrl(rawBaseUrl)
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error ? error.message : '接口地址验证失败。',
      })
      return
    }

    const credentialRecord = {
      provider: 'custom',
      provider_type: 'custom',
      label,
      base_url: baseUrl,
      adapter,
    }
    let models = []

    try {
      models = await listProviderModels('custom', apiKey, credentialRecord)
    } catch (_error) {
      response.status(502).json({
        error: '连接失败，请检查地址、接口格式和 API Key。',
      })
      return
    }

    const { error } = await saveProviderCredential(
      request.db,
      request.user.id,
      'custom',
      apiKey,
      {
        providerType: 'custom',
        label,
        baseUrl,
        adapter,
      },
    )

    if (error) {
      if (isMissingProviderCredentialsTable(error)) {
        response.status(503).json({
          error: '供应商凭据表尚未创建，请先执行数据库迁移。',
        })
        return
      }

      console.error(`保存自定义供应商失败：${error.code ?? 'unknown'}`)
      response.status(500).json({
        error: '连接成功，但自定义供应商配置没有保存成功。',
      })
      return
    }

    response.json({
      provider: {
        id: 'custom',
        label,
        credentialSource: 'stored',
        connected: true,
        baseUrl,
        adapter,
      },
      models,
      message: '连接成功，已安全保存地址和 API Key。',
    })
  },
)
app.post(
  '/api/providers/:provider/connect',
  requireUser,
  async (request, response) => {
    const provider = getProviderDefinition(request.params.provider)

    if (!provider || provider.credentialSource !== 'stored') {
      response.status(400).json({
        error: '不支持连接这个模型供应商。',
      })
      return
    }

    if (!isCredentialEncryptionConfigured()) {
      response.status(503).json({
        error: '后端凭据加密尚未配置。',
      })
      return
    }

    const apiKey =
      typeof request.body?.apiKey === 'string'
        ? request.body.apiKey.trim()
        : ''

    if (!apiKey) {
      response.status(400).json({
        error: '请输入该供应商的 API Key。',
      })
      return
    }

    let models = []

    try {
      models = await listProviderModels(provider.id, apiKey)
    } catch (_error) {
      response.status(502).json({
        error: '连接失败，请检查 API Key 和账号权限。',
      })
      return
    }

    const { error } = await saveProviderCredential(
      request.db,
      request.user.id,
      provider.id,
      apiKey,
    )

    if (error) {
      if (isMissingProviderCredentialsTable(error)) {
        response.status(503).json({
          error: '供应商凭据表尚未创建，请先执行数据库迁移。',
        })
        return
      }

      console.error(`保存供应商凭据失败：${error.code ?? 'unknown'}`)
      response.status(500).json({
        error: 'API Key 验证成功，但暂时无法安全保存。',
      })
      return
    }

    response.json({
      provider: {
        id: provider.id,
        label: provider.label,
      },
      models,
      message: '连接成功，已安全保存凭据。',
    })
  },
)

app.get(
  '/api/providers/:provider/models',
  requireUser,
  async (request, response) => {
    const providerId = request.params.provider
    let credentialRecord = null
    let apiKey = modelApiKey

    if (providerId === 'custom') {
      const result = await getProviderCredential(
        request.db,
        request.user.id,
        'custom',
      )

      if (result.error) {
        if (isMissingProviderCredentialsTable(result.error)) {
          response.status(503).json({
            error: '供应商凭据表尚未创建，请先执行数据库迁移。',
          })
          return
        }

        response.status(500).json({
          error: '自定义供应商配置暂时无法读取。',
        })
        return
      }

      credentialRecord = result.record
      apiKey = result.credential || ''
    } else {
      const provider = getProviderDefinition(providerId)

      if (!provider) {
        response.status(400).json({
          error: '不支持这个模型供应商。',
        })
        return
      }

      if (provider.credentialSource === 'stored') {
        const result = await getProviderCredential(
          request.db,
          request.user.id,
          provider.id,
        )

        if (result.error) {
          if (isMissingProviderCredentialsTable(result.error)) {
            response.status(503).json({
              error: '供应商凭据表尚未创建，请先执行数据库迁移。',
            })
            return
          }

          response.status(500).json({
            error: '供应商凭据暂时无法读取。',
          })
          return
        }

        credentialRecord = result.record
        apiKey = result.credential || ''
      }
    }

    const provider = getProviderDefinition(providerId, credentialRecord)

    if (!provider) {
      response.status(400).json({
        error: '请先完成自定义供应商连接。',
      })
      return
    }

    if (!apiKey) {
      response.status(400).json({
        error: '请先连接这个模型供应商。',
      })
      return
    }

    try {
      const models = await listProviderModels(
        provider.id,
        apiKey,
        credentialRecord,
      )
      response.json({ models })
    } catch (_error) {
      response.status(502).json({
        error: '无法拉取模型列表，请稍后重试。',
      })
    }
  },
)
app.delete(
  '/api/providers/:provider',
  requireUser,
  async (request, response) => {
    const provider = getProviderDefinition(request.params.provider)

    if (!provider || provider.credentialSource !== 'stored') {
      response.status(400).json({
        error: '不能删除这个供应商配置。',
      })
      return
    }

    const { error } = await deleteProviderCredential(
      request.db,
      request.user.id,
      provider.id,
    )

    if (error) {
      if (isMissingProviderCredentialsTable(error)) {
        response.status(503).json({
          error: '供应商凭据表尚未创建。',
        })
        return
      }

      response.status(500).json({
        error: '供应商凭据删除失败，请稍后重试。',
      })
      return
    }

    response.status(204).end()
  },
)
app.get('/api/settings', requireUser, async (request, response) => {
  const { settings, persisted, error } = await getOrCreateUserSettings(
    request.db,
    request.user.id,
  )

  if (error) {
    console.error(`读取设置失败：${error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '用户设置暂时无法读取，请稍后重试。',
    })
    return
  }

  response.json({
    settings,
    persisted,
    message: persisted
      ? null
      : '设置表尚未创建，当前使用后端默认设置，暂时无法保存。',
  })
})

app.patch('/api/settings', requireUser, async (request, response) => {
  const currentResult = await getOrCreateUserSettings(
    request.db,
    request.user.id,
  )

  if (currentResult.error) {
    console.error(`读取设置失败：${currentResult.error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '用户设置暂时无法读取，请稍后重试。',
    })
    return
  }

  if (!currentResult.persisted) {
    response.status(503).json({
      error: '设置表尚未创建，请先在 Supabase 执行设置表迁移。',
    })
    return
  }

  const current = currentResult.settings
  const provider =
    typeof request.body?.provider === 'string'
      ? request.body.provider.trim()
      : current.provider || 'gateway'
  const systemPrompt =
    typeof request.body?.systemPrompt === 'string'
      ? request.body.systemPrompt.trim()
      : current.systemPrompt
  const modelName =
    typeof request.body?.modelName === 'string'
      ? request.body.modelName.trim()
      : current.modelName
  const maxReplyTokens = Number.parseInt(
    String(request.body?.maxReplyTokens ?? current.maxReplyTokens),
    10,
  )
  const temperature = Number.parseFloat(
    String(request.body?.temperature ?? current.temperature),
  )

  if (!systemPrompt) {
    response.status(400).json({
      error: '系统提示词不能为空。',
    })
    return
  }

  if (systemPrompt.length > 20000) {
    response.status(400).json({
      error: '系统提示词不能超过 20000 个字符。',
    })
    return
  }

  let providerApiKey = modelApiKey
  let credentialRecord = null
  const staticProvider = getProviderDefinition(provider)

  if (provider === 'custom' || staticProvider?.credentialSource === 'stored') {
    const credentialResult = await getProviderCredential(
      request.db,
      request.user.id,
      provider,
    )

    if (credentialResult.error) {
      console.error('读取供应商凭据失败')
      response.status(500).json({
        error: '供应商凭据暂时无法读取，请稍后重试。',
      })
      return
    }

    credentialRecord = credentialResult.record
    providerApiKey = credentialResult.credential || ''
  }

  const providerDefinition = getProviderDefinition(provider, credentialRecord)

  if (!providerDefinition) {
    response.status(400).json({
      error: '不支持所选模型供应商，或自定义供应商尚未连接。',
    })
    return
  }

  if (!modelName) {
    response.status(400).json({
      error: '默认模型名称不能为空。',
    })
    return
  }

  if (modelName.length > 200) {
    response.status(400).json({
      error: '默认模型名称不能超过 200 个字符。',
    })
    return
  }

  if (!providerApiKey) {
    response.status(400).json({
      error: '请先在设置页连接所选模型供应商。',
    })
    return
  }

  let availableModels = []

  try {
    availableModels = await listProviderModels(
      provider,
      providerApiKey,
      credentialRecord,
    )
  } catch (_error) {
    response.status(502).json({
      error: '无法读取该供应商的模型列表，请检查 API Key。',
    })
    return
  }

  if (!availableModels.some((model) => model.id === modelName)) {
    response.status(400).json({
      error: '所选模型不在该供应商返回的模型列表中。',
    })
    return
  }

  if (
    !Number.isInteger(maxReplyTokens) ||
    maxReplyTokens < 1 ||
    maxReplyTokens > 512
  ) {
    response.status(400).json({
      error: '最大回复长度必须是 1 到 512 之间的整数。',
    })
    return
  }

  if (
    !Number.isFinite(temperature) ||
    temperature < 0 ||
    temperature > 1
  ) {
    response.status(400).json({
      error: '温度必须是 0 到 1 之间的数字。',
    })
    return
  }

  const { data, error } = await request.db
    .from('settings')
    .update({
      system_prompt: systemPrompt,
      provider,
      model_name: modelName,
      max_reply_tokens: maxReplyTokens,
      temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', request.user.id)
    .select(
      'provider, system_prompt, model_name, max_reply_tokens, temperature, updated_at',
    )
    .single()

  if (error) {
    console.error(`保存设置失败：${error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '设置保存失败，请稍后重试。',
    })
    return
  }

  response.json({
    settings: mapSettings(data),
    message: '设置已保存。',
  })
})
app.get('/api/sessions', requireUser, async (request, response) => {
  const { data, error } = await request.db
    .from('sessions')
    .select('id, title, created_at, updated_at')
    .eq('owner_id', request.user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error(`读取会话失败：${error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '会话列表暂时无法加载，请稍后重试。',
    })
    return
  }

  response.json({
    sessions: data ?? [],
  })
})

app.post('/api/sessions', requireUser, async (request, response) => {
  const { data, error } = await request.db
    .from('sessions')
    .insert({
      owner_id: request.user.id,
      title: '新的会话',
    })
    .select('id, title, created_at, updated_at')
    .single()

  if (error) {
    console.error(`创建会话失败：${error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '新会话暂时无法创建，请稍后重试。',
    })
    return
  }

  response.status(201).json({
    session: data,
  })
})

app.get(
  '/api/sessions/:id/messages',
  requireUser,
  async (request, response) => {
    const sessionId = request.params.id

    if (!isValidUuid(sessionId)) {
      response.status(400).json({
        error: '会话地址无效。',
      })
      return
    }

    const { session, error: sessionError } = await getOwnedSession(
      request.db,
      sessionId,
      request.user.id,
    )

    if (sessionError) {
      console.error(`读取会话失败：${sessionError.code ?? 'unknown'}`)
      response.status(500).json({
        error: '历史记录暂时无法加载。',
      })
      return
    }

    if (!session) {
      response.status(404).json({
        error: '没有找到这个会话。',
      })
      return
    }

    const { data, error } = await request.db
      .from('messages')
      .select('id, session_id, role, content, created_at')
      .eq('session_id', sessionId)
      .eq('owner_id', request.user.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      console.error(`读取消息失败：${error.code ?? 'unknown'}`)
      response.status(500).json({
        error: '历史记录暂时无法加载。',
      })
      return
    }

    response.json({
      session,
      messages: data ?? [],
    })
  },
)

app.post(
  '/api/sessions/:id/messages',
  requireUser,
  async (request, response) => {
    const sessionId = request.params.id

    if (!isValidUuid(sessionId)) {
      response.status(400).json({
        error: '会话地址无效。',
      })
      return
    }

const message =
      typeof request.body?.message === 'string'
        ? request.body.message.trim()
        : ''

    if (!message) {
      response.status(400).json({
        error: '消息不能为空。',
      })
      return
    }

    if (message.length > 4000) {
      response.status(400).json({
        error: '消息太长，请缩短后重试。',
      })
      return
    }

    const { session, error: sessionError } = await getOwnedSession(
      request.db,
      sessionId,
      request.user.id,
    )

    if (sessionError) {
      console.error(`读取会话失败：${sessionError.code ?? 'unknown'}`)
      response.status(500).json({
        error: '会话读取失败，请稍后重试。',
        code: 'SESSION_READ_FAILED',
      })
      return
    }

    if (!session) {
      response.status(404).json({
        error: '没有找到这个会话。',
        code: 'SESSION_NOT_FOUND',
      })
      return
    }

    const {
      settings,
      error: settingsError,
    } = await getOrCreateUserSettings(request.db, request.user.id)

    if (settingsError) {
      console.error(`读取设置失败：${settingsError.code ?? 'unknown'}`)
      response.status(500).json({
        error: '用户设置暂时无法读取，请稍后重试。',
        code: 'SETTINGS_READ_FAILED',
      })
      return
    }

    if (!settings.modelName) {
      response.status(503).json({
        error: '默认模型名称尚未配置，请先在设置页填写。',
        code: 'MODEL_NAME_MISSING',
      })
      return
    }

    const providerId = settings.provider || 'gateway'
    let credentialRecord = null
    const staticProvider = getProviderDefinition(providerId)
    let providerApiKey = modelApiKey

    if (providerId === 'custom' || staticProvider?.credentialSource === 'stored') {
      const credentialResult = await getProviderCredential(
        request.db,
        request.user.id,
        providerId,
      )

      if (credentialResult.error) {
        response.status(500).json({
          error: '供应商凭据暂时无法读取，请稍后重试。',
          code: 'PROVIDER_CREDENTIAL_FAILED',
        })
        return
      }

      credentialRecord = credentialResult.record
      providerApiKey = credentialResult.credential || ''
    }

    const provider = getProviderDefinition(providerId, credentialRecord)

    if (!provider) {
      response.status(400).json({
        error: '当前设置中的模型供应商不受支持，或自定义供应商尚未连接。',
        code: 'PROVIDER_NOT_ALLOWED',
      })
      return
    }

    if (!providerApiKey) {
      response.status(503).json({
        error: '请先在设置页连接当前模型供应商。',
        code: 'PROVIDER_NOT_CONNECTED',
      })
      return
    }

    let reply = ''

    try {
      reply = await requestProviderReply({
        credentialRecord,
        providerId: provider.id,
        apiKey: providerApiKey,
        modelName: settings.modelName,
        systemPrompt: settings.systemPrompt,
        message,
        maxReplyTokens: settings.maxReplyTokens,
        temperature: settings.temperature,
      })
    } catch (_error) {
      console.error('模型请求未能完成')
      response.status(502).json({
        error: '枭暂时没有回复，请重试。',
        code: 'MODEL_FAILED',
      })
      return
    }

    const { data: userMessage, error: userMessageError } = await request.db
      .from('messages')
      .insert({
        session_id: sessionId,
        owner_id: request.user.id,
        role: 'user',
        content: message,
      })
      .select('id, session_id, role, content, created_at')
      .single()

    if (userMessageError) {
      console.error(`保存用户消息失败：${userMessageError.code ?? 'unknown'}`)
      response.status(500).json({
        error: '消息没有保存成功，请重试。',
        code: 'USER_MESSAGE_SAVE_FAILED',
      })
      return
    }

    const { data: assistantMessage, error: assistantMessageError } =
      await request.db
        .from('messages')
        .insert({
          session_id: sessionId,
          owner_id: request.user.id,
          role: 'assistant',
          content: reply,
        })
        .select('id, session_id, role, content, created_at')
        .single()

    if (assistantMessageError) {
      console.error(
        `保存助手消息失败：${assistantMessageError.code ?? 'unknown'}`,
      )

      const { error: rollbackError } = await request.db
        .from('messages')
        .delete()
        .eq('id', userMessage.id)
        .eq('owner_id', request.user.id)

      if (rollbackError) {
        console.error(`回滚用户消息失败：${rollbackError.code ?? 'unknown'}`)
      }

      response.status(500).json({
        error: '回复没有保存成功，请重试。',
        code: 'REPLY_SAVE_FAILED',
      })
      return
    }

    const nextTitle =
      session.title === '新的会话' ? message.slice(0, 24) : session.title
    const nextUpdatedAt = new Date().toISOString()
    const { data: finalSession, error: finalSessionError } = await request.db
      .from('sessions')
      .update({
        title: nextTitle,
        updated_at: nextUpdatedAt,
      })
      .eq('id', sessionId)
      .eq('owner_id', request.user.id)
      .select('id, title, created_at, updated_at')
      .single()

    if (finalSessionError) {
      console.error(`更新会话失败：${finalSessionError.code ?? 'unknown'}`)
    }

    response.json({
      session:
        finalSession ?? {
          ...session,
          title: nextTitle,
          updated_at: nextUpdatedAt,
        },
      userMessage,
      assistantMessage,
      warning: finalSessionError
        ? '消息已保存，但会话状态更新失败。'
        : null,
    })
  },
)
app.patch('/api/sessions/:id', requireUser, async (request, response) => {
  const sessionId = request.params.id

  if (!isValidUuid(sessionId)) {
    response.status(400).json({
      error: '会话地址无效。',
    })
    return
  }

  const title =
    typeof request.body?.title === 'string' ? request.body.title.trim() : ''

  if (!title) {
    response.status(400).json({
      error: '会话名称不能为空。',
    })
    return
  }

  if (title.length > 120) {
    response.status(400).json({
      error: '会话名称不能超过 120 个字符。',
    })
    return
  }

  const { data, error } = await request.db
    .from('sessions')
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('owner_id', request.user.id)
    .select('id, title, created_at, updated_at')
    .maybeSingle()

  if (error) {
    console.error(`重命名会话失败：${error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '会话重命名失败，请稍后重试。',
    })
    return
  }

  if (!data) {
    response.status(404).json({
      error: '没有找到这个会话。',
    })
    return
  }

  response.json({
    session: data,
  })
})
app.delete('/api/sessions/:id', requireUser, async (request, response) => {
  const sessionId = request.params.id

  if (!isValidUuid(sessionId)) {
    response.status(400).json({
      error: '会话地址无效。',
    })
    return
  }

  const { data, error } = await request.db
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('owner_id', request.user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error(`删除会话失败：${error.code ?? 'unknown'}`)
    response.status(500).json({
      error: '会话删除失败，请稍后重试。',
    })
    return
  }

  if (!data) {
    response.status(404).json({
      error: '没有找到这个会话。',
    })
    return
  }

  response.status(204).end()
})

app.use((_request, response) => {
  response.status(404).json({
    error: '未找到该接口',
  })
})

app.use((error, _request, response, _next) => {
  console.error(`服务请求失败：${error.code ?? 'unknown'}`)
  response.status(500).json({
    error: '服务暂时不可用，请稍后重试。',
  })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`森月居后端已启动：http://localhost:${port}`)
  console.log(`模型配置：${isModelConfigured ? '已就绪' : '未完成'}`)
  console.log(`数据库配置：${databaseConfigured ? '已就绪' : '未完成'}`)
  console.log(`最大回复长度：${modelMaxTokens} tokens`)
})
