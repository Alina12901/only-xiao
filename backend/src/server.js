import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
app.use(express.json())

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
    phase: '第二阶段：最小一问一答',
    provider: 'openai-compatible',
    modelConfigured: isModelConfigured,
    modelNameConfigured: Boolean(modelName),
    promptConfigured: Boolean(modelSystemPrompt),
    maxReplyTokens: modelMaxTokens,
    databaseConnected: false,
    memoryEnabled: false,
  })
})

app.post('/api/chat', async (request, response) => {
  const message =
    typeof request.body?.message === 'string' ? request.body.message.trim() : ''

  if (!message) {
    response.status(400).json({
      error: '消息不能为空。',
    })
    return
  }

  if (!isModelConfigured) {
    response.status(503).json({
      error:
        '模型尚未配置，请检查后端 .env 和系统提示词配置文件。',
    })
    return
  }

  try {
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
      response.status(502).json({
        error: '模型服务暂时没有返回有效结果，请检查后端配置。',
      })
      return
    }

    const data = await modelResponse.json()
    const reply = data?.choices?.[0]?.message?.content

    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('模型响应中没有文本内容')
    }

    response.json({ reply: reply.trim() })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const safeErrorMessage = errorMessage.replaceAll(modelApiKey, '[redacted]')
    console.error(`模型请求未能完成：${safeErrorMessage}`)
    response.status(502).json({
      error: '模型服务暂时不可用，请稍后再试。',
    })
  }
})

app.use((_request, response) => {
  response.status(404).json({
    error: '未找到该接口',
  })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`森月居后端已启动：http://localhost:${port}`)
  console.log(`模型配置：${isModelConfigured ? '已就绪' : '未完成'}`)
  console.log(`最大回复长度：${modelMaxTokens} tokens`)
})
