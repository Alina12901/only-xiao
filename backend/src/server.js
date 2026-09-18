import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
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

async function requestModelReply(message) {
  const modelResponse = await fetch(modelEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${modelApiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: modelSystemPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: modelMaxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!modelResponse.ok) {
    const providerError = await modelResponse.text()
    const safeProviderError = providerError
      .replaceAll(modelApiKey, '[redacted]')
      .slice(0, 500)
    console.error(
      `模型请求失败，HTTP ${modelResponse.status}：${safeProviderError}`,
    )
    throw new Error('模型服务返回错误')
  }

  const data = await modelResponse.json()
  const reply = data?.choices?.[0]?.message?.content

  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('模型响应中没有文本内容')
  }

  return reply.trim()
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
    phase: '第三阶段：Supabase 持久化',
    provider: 'openai-compatible',
    modelConfigured: isModelConfigured,
    modelNameConfigured: Boolean(modelName),
    promptConfigured: Boolean(modelSystemPrompt),
    maxReplyTokens: modelMaxTokens,
    databaseConfigured,
    secretKeyConfigured: Boolean(supabaseSecretKey),
    authRequired: true,
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

    if (!isModelConfigured) {
      response.status(503).json({
        error: '模型尚未配置，暂时不能回复消息。',
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
      })
      return
    }

    if (!session) {
      response.status(404).json({
        error: '没有找到这个会话。',
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
        error: '消息没有发送成功，请重试。',
      })
      return
    }

    const nextTitle =
      session.title === '新的会话' ? message.slice(0, 24) : session.title
    const { data: updatedSession, error: sessionUpdateError } = await request.db
      .from('sessions')
      .update({
        title: nextTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('owner_id', request.user.id)
      .select('id, title, created_at, updated_at')
      .single()

    if (sessionUpdateError) {
      console.error(`更新会话失败：${sessionUpdateError.code ?? 'unknown'}`)
      response.status(500).json({
        error: '消息已保存，但会话状态更新失败，请稍后重试。',
      })
      return
    }

    let reply = ''

    try {
      reply = await requestModelReply(message)
    } catch (_error) {
      console.error('模型请求未能完成')
      response.status(502).json({
        error: '消息已保存，但枭暂时没有回复。',
        code: 'MODEL_FAILED',
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
      response.status(500).json({
        error: '枭已回复，但回复没有保存成功，请重试。',
      })
      return
    }

    const { data: finalSession, error: finalSessionError } = await request.db
      .from('sessions')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('owner_id', request.user.id)
      .select('id, title, created_at, updated_at')
      .single()

    if (finalSessionError) {
      console.error(`更新会话时间失败：${finalSessionError.code ?? 'unknown'}`)
    }

    response.json({
      session: finalSession ?? updatedSession,
      userMessage,
      assistantMessage,
      warning: finalSessionError
        ? '消息已保存，但会话排序时间更新失败。'
        : null,
    })
  },
)

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
