const gatewayBaseUrl = (
  process.env.MODEL_BASE_URL?.trim() || 'https://emtf.aipm9527.site'
).replace(/\/+$/, '')

const officialProviders = {
  gateway: {
    id: 'gateway',
    label: '森月居兼容网关',
    credentialSource: 'environment',
    adapter: 'openai-chat',
    baseUrl: gatewayBaseUrl.endsWith('/v1')
      ? gatewayBaseUrl
      : `${gatewayBaseUrl}/v1`,
    modelsPath: '/models',
    chatPath: '/chat/completions',
    auth: 'bearer',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI 官方',
    credentialSource: 'stored',
    adapter: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    modelsPath: '/models',
    chatPath: '/responses',
    auth: 'bearer',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic 官方',
    credentialSource: 'stored',
    adapter: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com/v1',
    modelsPath: '/models',
    chatPath: '/messages',
    auth: 'anthropic',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek 官方',
    credentialSource: 'stored',
    adapter: 'openai-chat',
    baseUrl: 'https://api.deepseek.com',
    modelsPath: '/models',
    chatPath: '/chat/completions',
    auth: 'bearer',
  },
}

function normalizeCustomBaseUrl(baseUrl) {
  const value = baseUrl.trim().replace(/\/+$/, '')
  return value.endsWith('/v1') ? value : `${value}/v1`
}

function createCustomProvider(record) {
  if (!record?.base_url || !record?.adapter) {
    return null
  }

  const baseUrl = normalizeCustomBaseUrl(record.base_url)
  const isAnthropic = record.adapter === 'anthropic-messages'

  return {
    id: 'custom',
    label: record.label || '自定义第三方 API',
    credentialSource: 'stored',
    adapter: record.adapter,
    baseUrl,
    modelsPath: '/models',
    chatPath: isAnthropic ? '/messages' : '/chat/completions',
    auth: isAnthropic ? 'anthropic' : 'bearer',
  }
}

export function getProviderCatalog() {
  return [
    ...Object.values(officialProviders).map((provider) => ({
      id: provider.id,
      label: provider.label,
      credentialSource: provider.credentialSource,
    })),
    {
      id: 'custom',
      label: '自定义第三方 API',
      credentialSource: 'stored',
    },
  ]
}

export function getProviderDefinition(providerId, credentialRecord = null) {
  if (providerId === 'custom') {
    return createCustomProvider(credentialRecord)
  }

  return officialProviders[providerId] ?? null
}

function createHeaders(provider, apiKey) {
  const headers = {
    'content-type': 'application/json',
  }

  if (provider.auth === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers.authorization = `Bearer ${apiKey}`
  }

  return headers
}

function createUrl(provider, path) {
  return `${provider.baseUrl.replace(/\/+$/, '')}${path}`
}

function parseOpenAiModels(data) {
  const list = Array.isArray(data?.data) ? data.data : []

  return list
    .map((model) => ({
      id: model.id,
      label: model.name || model.id,
    }))
    .filter((model) => model.id)
}

function parseAnthropicModels(data) {
  const list = Array.isArray(data?.data) ? data.data : []

  return list
    .map((model) => ({
      id: model.id,
      label: model.display_name || model.name || model.id,
    }))
    .filter((model) => model.id)
}

export async function listProviderModels(
  providerId,
  apiKey,
  credentialRecord = null,
) {
  const provider = getProviderDefinition(providerId, credentialRecord)

  if (!provider || !apiKey) {
    throw new Error('供应商或凭据无效')
  }

  const response = await fetch(createUrl(provider, provider.modelsPath), {
    method: 'GET',
    headers: createHeaders(provider, apiKey),
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`模型列表请求失败，HTTP ${response.status}`)
  }

  const data = await response.json()
  const models =
    provider.adapter === 'anthropic-messages'
      ? parseAnthropicModels(data)
      : parseOpenAiModels(data)

  return models.sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN'),
  )
}

function parseOpenAiChatReply(data) {
  const reply = data?.choices?.[0]?.message?.content
  return typeof reply === 'string' ? reply.trim() : ''
}

function parseOpenAiResponsesReply(data) {
  const output = Array.isArray(data?.output) ? data.output : []
  const textParts = output.flatMap((item) =>
    Array.isArray(item?.content) ? item.content : [],
  )

  return textParts
    .filter((part) => part?.type === 'output_text')
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim()
}

function parseAnthropicReply(data) {
  const content = Array.isArray(data?.content) ? data.content : []

  return content
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .filter(Boolean)
    .join('\n')
    .trim()
}

export async function requestProviderReply({
  providerId,
  credentialRecord,
  apiKey,
  modelName,
  systemPrompt,
  message,
  maxReplyTokens,
  temperature,
}) {
  const provider = getProviderDefinition(providerId, credentialRecord)

  if (!provider || !apiKey || !modelName) {
    throw new Error('模型配置不完整')
  }

  let body

  if (provider.adapter === 'openai-responses') {
    body = {
      model: modelName,
      instructions: systemPrompt,
      input: message,
      max_output_tokens: maxReplyTokens,
      temperature,
    }
  } else if (provider.adapter === 'anthropic-messages') {
    body = {
      model: modelName,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: maxReplyTokens,
      temperature,
    }
  } else {
    body = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: maxReplyTokens,
      temperature,
      stream: false,
    }
  }

  const response = await fetch(createUrl(provider, provider.chatPath), {
    method: 'POST',
    headers: createHeaders(provider, apiKey),
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    await response.text().catch(() => '')
    throw new Error(`模型请求失败，HTTP ${response.status}`)
  }

  const data = await response.json()

  if (provider.adapter === 'openai-responses') {
    return parseOpenAiResponsesReply(data)
  }

  if (provider.adapter === 'anthropic-messages') {
    return parseAnthropicMessagesReply(data)
  }

  return parseOpenAiChatReply(data)
}

function parseAnthropicMessagesReply(data) {
  return parseAnthropicReply(data)
}
