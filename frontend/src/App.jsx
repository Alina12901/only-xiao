import { useEffect, useRef, useState } from 'react'
import './App.css'

const aiProfile = {
  name: '枭',
  avatarUrl: null,
}

const formatMessageTime = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const formatSessionTime = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  return new Intl.DateTimeFormat('zh-CN', isToday
    ? {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    : {
        month: '2-digit',
        day: '2-digit',
      }).format(date)
}

function ProfileAvatar({ className, label, imageUrl }) {
  return (
    <div className={className} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : label}
    </div>
  )
}

function AuthScreen({
  authError,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <ProfileAvatar
            className="brand-mark"
            label={aiProfile.name}
            imageUrl={aiProfile.avatarUrl}
          />
          <div>
            <p className="brand-kicker">私人静室</p>
            <h1>森月居</h1>
          </div>
        </div>

        <div className="auth-copy">
          <p>登录后，会话和历史记录只对当前账号开放。</p>
        </div>

        <label className="auth-field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="auth-field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {authError && (
          <p className="auth-error" role="alert">
            {authError}
          </p>
        )}

        <button className="auth-submit" type="submit">
          进入森月居
        </button>
        <p className="auth-help">
          账号需要在 Supabase 中预先创建，本应用不开放注册。
        </p>
      </form>
    </div>
  )
}

function SettingsPanel({
  error,
  form,
  isLoading,
  isPersisted,
  isSaving,
  message,
  customProviderForm,
  onCustomProviderChange,
  providerApiKey,
  providerMessage,
  providerModels,
  providers,
  isConnectingProvider,
  onProviderChange,
  onProviderKeyChange,
  onConnectProvider,
  onDisconnectProvider,
  onRefreshModels,
  onBack,
  onChange,
  onSubmit,
}) {
  const selectedProvider = providers.find(
    (provider) => provider.id === form.provider,
  )
  return (
    <section className="settings-view">
      <header className="settings-header">
        <div>
          <p className="chat-eyebrow">私人配置</p>
          <h2>设置</h2>
        </div>
        <button className="settings-back" type="button" onClick={onBack}>
          返回对话
        </button>
      </header>

      <div className="settings-body">
        {isLoading ? (
          <p className="settings-loading">正在加载设置……</p>
        ) : (
          <form className="settings-form" onSubmit={onSubmit}>
            {!isPersisted && (
              <p className="settings-warning" role="alert">
                设置表尚未创建。当前显示后端默认值，暂时无法保存。
              </p>
            )}

            <label className="settings-field">
              <span>系统提示词</span>
              <textarea
                value={form.systemPrompt}
                onChange={(event) =>
                  onChange('systemPrompt', event.target.value)
                }
                rows="12"
                disabled={isSaving}
              />
              <small>决定枭的角色、语气和回答边界。</small>
            </label>            <div className="provider-card">
              <label className="settings-field">
                <span>模型供应商</span>
                <select
                  value={form.provider}
                  onChange={(event) => onProviderChange(event.target.value)}
                  disabled={isSaving || isConnectingProvider}
                >
                  {providers.map((provider) => (
                    <option value={provider.id} key={provider.id}>
                      {provider.label}
                      {provider.connected ? ' · 已连接' : ''}
                    </option>
                  ))}
                </select>
                <small>供应商地址由后端维护，前端不能填写任意地址。</small>
              </label>

              {form.provider === 'custom' && (
                <div className="custom-provider-fields">
                  <label className="settings-field">
                    <span>显示名称</span>
                    <input
                      type="text"
                      value={customProviderForm.label}
                      onChange={(event) =>
                        onCustomProviderChange((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      disabled={isConnectingProvider}
                    />
                  </label>

                  <label className="settings-field">
                    <span>接口格式</span>
                    <select
                      value={customProviderForm.adapter}
                      onChange={(event) =>
                        onCustomProviderChange((current) => ({
                          ...current,
                          adapter: event.target.value,
                        }))
                      }
                      disabled={isConnectingProvider}
                    >
                      <option value="openai-chat">
                        OpenAI Chat Completions 兼容
                      </option>
                      <option value="anthropic-messages">
                        Anthropic Messages 兼容
                      </option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span>接口基础地址</span>
                    <input
                      type="url"
                      value={customProviderForm.baseUrl}
                      onChange={(event) =>
                        onCustomProviderChange((current) => ({
                          ...current,
                          baseUrl: event.target.value,
                        }))
                      }
                      placeholder="https://example.com"
                      disabled={isConnectingProvider}
                    />
                    <small>只允许 HTTPS 公网地址，地址会加密保存。</small>
                  </label>
                </div>
              )}
              {selectedProvider?.credentialSource === 'stored' &&
                !selectedProvider.connected && (
                  <div className="provider-connect">
                    <label className="settings-field">
                      <span>API Key</span>
                      <input
                        type="password"
                        value={providerApiKey}
                        onChange={(event) =>
                          onProviderKeyChange(event.target.value)
                        }
                        placeholder="只发送到后端，不会回显"
                        disabled={isConnectingProvider}
                      />
                    </label>
                    <button
                      className="provider-button"
                      type="button"
                      onClick={onConnectProvider}
                      disabled={isConnectingProvider || !providerApiKey.trim()}
                    >
                      {isConnectingProvider ? '连接中' : '连接并拉取模型'}
                    </button>
                  </div>
                )}

              {selectedProvider?.connected && (
                <div className="provider-connected">
                  <span>已连接</span>
                  {selectedProvider.credentialSource === 'stored' && (
                    <button
                      type="button"
                      onClick={onDisconnectProvider}
                      disabled={isConnectingProvider}
                    >
                      删除 Key
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onRefreshModels}
                    disabled={isConnectingProvider}
                  >
                    刷新模型
                  </button>
                </div>
              )}

              {providerMessage && (
                <p className="provider-message">{providerMessage}</p>
              )}
            </div>

            <label className="settings-field">
              <span>默认模型</span>
              <select
                value={form.modelName}
                onChange={(event) => onChange('modelName', event.target.value)}
                disabled={isSaving || !providerModels.length}
              >
                {!providerModels.length && (
                  <option value="">请先连接供应商并拉取模型</option>
                )}
                {providerModels.map((model) => (
                  <option value={model.id} key={model.id}>
                    {model.label} ({model.id})
                  </option>
                ))}
              </select>
              <small>只能选择该供应商官方返回的模型。</small>
            </label>

            <div className="settings-grid">
              <label className="settings-field">
                <span>最大回复长度</span>
                <input
                  type="number"
                  min="1"
                  max="512"
                  step="1"
                  value={form.maxReplyTokens}
                  onChange={(event) =>
                    onChange('maxReplyTokens', event.target.value)
                  }
                  disabled={isSaving}
                />
                <small>允许 1 到 512 tokens。</small>
              </label>

              <label className="settings-field">
                <span>温度</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.temperature}
                  onChange={(event) => onChange('temperature', event.target.value)}
                  disabled={isSaving}
                />
                <small>
                  当前按 Claude 接口使用 0 到 1；Thinking 模式可能要求 1。
                </small>
              </label>
            </div>

            {error && (
              <p className="settings-error" role="alert">
                {error}
              </p>
            )}

            {message && <p className="settings-message">{message}</p>}

            <button
              className="settings-save"
              type="submit"
              disabled={isSaving || !isPersisted}
            >
              {isSaving ? '保存中' : '保存设置'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [activeView, setActiveView] = useState('chat')
  const [settingsForm, setSettingsForm] = useState({
    provider: 'gateway',
    systemPrompt: '',
    modelName: '',
    maxReplyTokens: 256,
    temperature: 1,
  })
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSettingsPersisted, setIsSettingsPersisted] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [providers, setProviders] = useState([])
  const [providerModels, setProviderModels] = useState([])
  const [providerApiKey, setProviderApiKey] = useState('')
  const [isConnectingProvider, setIsConnectingProvider] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
  const [customProviderForm, setCustomProviderForm] = useState({
    label: '自定义第三方 API',
    baseUrl: '',
    adapter: 'openai-chat',
  })
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [notice, setNotice] = useState('')
  const [renameSession, setRenameSession] = useState(null)
  const accessTokenRef = useRef('')
  const [renameDraft, setRenameDraft] = useState('')
  const activeIdRef = useRef(null)
  const [renameError, setRenameError] = useState('')
  const messagesEndRef = useRef(null)
  const [isRenaming, setIsRenaming] = useState(false)

  const activeConversation =
    sessions.find((session) => session.id === activeId) ?? null

  const refreshSession = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || typeof data.accessToken !== 'string') {
        accessTokenRef.current = ''
        setUser(null)
        setAuthStatus('signedOut')
        return false
      }

      accessTokenRef.current = data.accessToken
      setUser(data.user)
      setAuthError('')
      setAuthStatus('authenticated')
      return true
    } catch (_error) {
      accessTokenRef.current = ''
      setUser(null)
      setAuthError('暂时无法连接后端，请确认服务已经启动。')
      setAuthStatus('signedOut')
      return false
    }
  }

  const apiRequest = async (path, options = {}, allowRefresh = true) => {
    const headers = new Headers(options.headers ?? {})

    if (accessTokenRef.current) {
      headers.set('Authorization', `Bearer ${accessTokenRef.current}`)
    }

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(path, {
      ...options,
      headers,
    })

    if (response.status === 401 && allowRefresh) {
      const refreshed = await refreshSession()

      if (refreshed) {
        return apiRequest(path, options, false)
      }
    }

    return response
  }

  const loadMessages = async (sessionId) => {
    setActiveId(sessionId)
    setIsLoadingMessages(true)

    try {
      const response = await apiRequest(`/api/sessions/${sessionId}/messages`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '历史记录暂时无法加载。')
      }

      setMessages(data.messages ?? [])
    } catch (error) {
      setMessages([])
      setNotice(
        error instanceof Error ? error.message : '历史记录暂时无法加载。',
      )
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const loadSessions = async (preferredId = null) => {
    setIsLoadingSessions(true)

    try {
      const response = await apiRequest('/api/sessions')
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '会话列表暂时无法加载。')
      }

      const nextSessions = data.sessions ?? []
      setSessions(nextSessions)

      const nextId =
        (preferredId && nextSessions.some((item) => item.id === preferredId)
          ? preferredId
          : null) ??
        (activeId && nextSessions.some((item) => item.id === activeId)
          ? activeId
          : null) ??
        nextSessions[0]?.id ??
        null

      if (nextId) {
        await loadMessages(nextId)
      } else {
        setActiveId(null)
        setMessages([])
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '会话列表暂时无法加载。',
      )
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const loadSettings = async () => {
    setIsLoadingSettings(true)
    setSettingsError('')
    setSettingsMessage('')

    try {
      const response = await apiRequest('/api/settings')
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.settings) {
        throw new Error(data.error || '用户设置暂时无法读取。')
      }

      setSettingsForm(data.settings)
      setIsSettingsPersisted(data.persisted !== false)
      await loadProviderCatalog(data.settings.provider)

      if (data.message) {
        setSettingsMessage(data.message)
      }
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : '用户设置暂时无法读取。',
      )
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const loadProviderModels = async (providerId) => {
    setProviderMessage('')
    setProviderModels([])

    try {
      const response = await apiRequest(`/api/providers/${providerId}/models`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '模型列表暂时无法加载。')
      }

      const models = data.models ?? []
      setProviderModels(models)
      setSettingsForm((current) => {
        const modelExists = models.some(
          (model) => model.id === current.modelName,
        )

        return modelExists
          ? current
          : {
              ...current,
              modelName: models[0]?.id ?? '',
            }
      })
      setProviderMessage(`已拉取 ${models.length} 个模型。`)
    } catch (error) {
      setProviderMessage(
        error instanceof Error ? error.message : '模型列表暂时无法加载。',
      )
    }
  }

  const loadProviderCatalog = async (preferredProvider) => {
    try {
      const response = await apiRequest('/api/providers')
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !Array.isArray(data.providers)) {
        throw new Error(data.error || '供应商列表暂时无法加载。')
      }

      setProviders(data.providers)
      const selected =
        data.providers.find((provider) => provider.id === preferredProvider) ??
        data.providers[0]

      if (!selected) {
        return
      }

      setSettingsForm((current) => ({
        ...current,
        provider: selected.id,
      }))

      if (selected.connected) {
        await loadProviderModels(selected.id)
      }
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : '供应商列表暂时无法加载。',
      )
    }
  }

  const handleProviderChange = async (providerId) => {
    setSettingsForm((current) => ({
      ...current,
      provider: providerId,
      modelName: '',
    }))
    setProviderModels([])
    setProviderApiKey('')
    setProviderMessage('')

    const provider = providers.find((item) => item.id === providerId)

    if (providerId === 'custom' && provider) {
      setCustomProviderForm({
        label: provider.label || '自定义第三方 API',
        baseUrl: provider.baseUrl || '',
        adapter: provider.adapter || 'openai-chat',
      })
    }

    if (provider?.connected) {
      await loadProviderModels(providerId)
    }
  }

  const handleConnectProvider = async () => {
    const providerId = settingsForm.provider
    const apiKey = providerApiKey.trim()
    const isCustom = providerId === 'custom'

    if (
      !providers.find((provider) => provider.id === providerId) ||
      !apiKey ||
      (isCustom &&
        (!customProviderForm.label.trim() ||
          !customProviderForm.baseUrl.trim()))
    ) {
      setProviderMessage('请填写完整的供应商连接信息。')
      return
    }

    setIsConnectingProvider(true)
    setProviderMessage('')

    try {
      const response = await apiRequest(
        isCustom
          ? '/api/providers/custom/connect'
          : `/api/providers/${providerId}/connect`,
        {
          method: 'POST',
          body: JSON.stringify(
            isCustom
              ? {
                  apiKey,
                  label: customProviderForm.label.trim(),
                  baseUrl: customProviderForm.baseUrl.trim(),
                  adapter: customProviderForm.adapter,
                }
              : { apiKey },
          ),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '供应商连接失败。')
      }

      const models = data.models ?? []
      setProviderModels(models)
      setProviderApiKey('')
      setProviderMessage(data.message || '连接成功。')
      setProviders((current) =>
        current.map((provider) =>
          provider.id === providerId
            ? {
                ...provider,
                ...(data.provider ?? {}),
                connected: true,
              }
            : provider,
        ),
      )
      setSettingsForm((current) => ({
        ...current,
        modelName: models[0]?.id ?? '',
      }))
    } catch (error) {
      setProviderMessage(
        error instanceof Error ? error.message : '供应商连接失败。',
      )
    } finally {
      setIsConnectingProvider(false)
    }
  }
  const handleDisconnectProvider = async () => {
    const providerId = settingsForm.provider

    if (!window.confirm('删除这个供应商已保存的 API Key？')) {
      return
    }

    try {
      const response = await apiRequest(`/api/providers/${providerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '供应商断开失败。')
      }

      setProviders((current) =>
        current.map((provider) =>
          provider.id === providerId
            ? { ...provider, connected: false }
            : provider,
        ),
      )
      setProviderModels([])
      setProviderApiKey('')
      setProviderMessage('已删除该供应商的 API Key。')
      setSettingsForm((current) => ({
        ...current,
        modelName: '',
      }))
    } catch (error) {
      setProviderMessage(
        error instanceof Error ? error.message : '供应商断开失败。',
      )
    }
  }
  const handleSettingsChange = (field, value) => {
    setSettingsForm((current) => ({
      ...current,
      [field]: value,
    }))
    setSettingsError('')
    setSettingsMessage('')
  }

  const handleSettingsSave = async (event) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsMessage('')

    const maxReplyTokens = Number.parseInt(
      String(settingsForm.maxReplyTokens),
      10,
    )
    const temperature = Number.parseFloat(String(settingsForm.temperature))

    if (!settingsForm.systemPrompt.trim()) {
      setSettingsError('系统提示词不能为空。')
      return
    }

    if (!settingsForm.modelName.trim()) {
      setSettingsError('默认模型名称不能为空。')
      return
    }

    if (
      !Number.isInteger(maxReplyTokens) ||
      maxReplyTokens < 1 ||
      maxReplyTokens > 512
    ) {
      setSettingsError('最大回复长度必须是 1 到 512 之间的整数。')
      return
    }

    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
      setSettingsError('温度必须是 0 到 1 之间的数字。')
      return
    }

    setIsSavingSettings(true)

    try {
      const response = await apiRequest('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          provider: settingsForm.provider,
          systemPrompt: settingsForm.systemPrompt.trim(),
          modelName: settingsForm.modelName.trim(),
          maxReplyTokens,
          temperature,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.settings) {
        throw new Error(data.error || '设置保存失败，请稍后重试。')
      }

      setSettingsForm(data.settings)
      setIsSettingsPersisted(true)
      setSettingsMessage(data.message || '设置已保存。')
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : '设置保存失败，请稍后重试。',
      )
    } finally {
      setIsSavingSettings(false)
    }
  }
  useEffect(() => {
    void refreshSession()
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') {
      void loadSessions()
    }
  }, [authStatus])

  useEffect(() => {
    if (authStatus === 'authenticated' && activeView === 'settings') {
      void loadSettings()
    }
  }, [authStatus, activeView])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages.length, activeId])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || typeof data.accessToken !== 'string') {
        throw new Error(data.error || '登录失败，请检查邮箱和密码。')
      }

      accessTokenRef.current = data.accessToken
      setUser(data.user)
      setPassword('')
      setAuthStatus('authenticated')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败。')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
    }).catch(() => null)

    accessTokenRef.current = ''
    setUser(null)
    setSessions([])
    setMessages([])
    setActiveId(null)
    setDraft('')
    setNotice('')
    setActiveView('chat')
    setSettingsError('')
    setSettingsMessage('')
    setAuthStatus('signedOut')
  }

  const handleNewConversation = async () => {
    setNotice('')

    try {
      const response = await apiRequest('/api/sessions', {
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.session) {
        throw new Error(data.error || '新会话暂时无法创建。')
      }

      setSessions((current) => [data.session, ...current])
      setActiveId(data.session.id)
      setMessages([])
      setDraft('')
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '新会话暂时无法创建。',
      )
    }
  }

  const handleSelectSession = async (sessionId) => {
    setNotice('')
    await loadMessages(sessionId)
  }

  const handleRenameSession = (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId)

    if (!session) {
      return
    }

    setRenameSession(session)
    setRenameDraft(session.title)
    setRenameError('')
  }

  const handleRenameSubmit = async (event) => {
    event.preventDefault()

    if (!renameSession) {
      return
    }

    const nextTitle = renameDraft.trim()

    if (!nextTitle) {
      setRenameError('会话名称不能为空。')
      return
    }

    if (nextTitle.length > 120) {
      setRenameError('会话名称不能超过 120 个字符。')
      return
    }

    if (nextTitle === renameSession.title) {
      setRenameSession(null)
      return
    }

    setIsRenaming(true)
    setRenameError('')

    try {
      const response = await apiRequest(`/api/sessions/${renameSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: nextTitle }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.session) {
        throw new Error(data.error || '会话重命名失败，请稍后重试。')
      }

      setSessions((current) =>
        current.map((item) =>
          item.id === data.session.id ? data.session : item,
        ),
      )
      setRenameSession(null)
      setRenameDraft('')
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : '会话重命名失败。',
      )
    } finally {
      setIsRenaming(false)
    }
  }
  const handleDeleteSession = async (sessionId) => {
    const sessionIndex = sessions.findIndex((item) => item.id === sessionId)
    const session = sessions[sessionIndex]

    if (
      !session ||
      !window.confirm(
        `确定删除会话“${session.title}”吗？\n\n该会话中的全部消息也会永久删除，且无法恢复。`,
      )
    ) {
      return
    }

    setNotice('')

    try {
      const response = await apiRequest(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '会话删除失败，请稍后重试。')
      }

      const remaining = sessions.filter((item) => item.id !== sessionId)
      setSessions(remaining)

      if (activeId === sessionId) {
        const nextSession =
          remaining[Math.min(sessionIndex, remaining.length - 1)] ?? null

        if (nextSession) {
          await loadMessages(nextSession.id)
        } else {
          setActiveId(null)
          setMessages([])
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '会话删除失败。')
    }
  }
  const handleSend = async (event) => {
    event.preventDefault()
    const text = draft.trim()

    if (!activeId) {
      setNotice('请先新建一个会话。')
      return
    }

    if (!text || isReplying) {
      return
    }

    const sessionId = activeId
    const optimisticMessage = {
      id: `pending-user-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      pending: true,
    }

    setMessages((current) => [...current, optimisticMessage])
    setDraft('')
    setNotice('')
    setIsReplying(true)

    try {
      const response = await apiRequest(
        `/api/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ message: text }),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setDraft(text)
        setNotice(data.error || '消息发送失败，请稍后重试。')

        if (activeIdRef.current === sessionId) {
          await loadMessages(sessionId)
        }

        return
      }

      if (activeIdRef.current === sessionId) {
        setMessages((current) => [
          ...current.filter((message) => message.id !== optimisticMessage.id),
          data.userMessage,
          data.assistantMessage,
        ])
      }

      setSessions((current) => {
        const updated = current.map((session) =>
          session.id === data.session.id ? data.session : session,
        )

        return updated.sort(
          (left, right) =>
            new Date(right.updated_at).getTime() -
            new Date(left.updated_at).getTime(),
        )
      })

      if (data.warning) {
        setNotice(data.warning)
      }
    } catch (error) {
      setDraft(text)
      setNotice(
        error instanceof Error ? error.message : '消息发送失败，请稍后重试。',
      )

      if (activeIdRef.current === sessionId) {
        await loadMessages(sessionId)
      }
    } finally {
      setIsReplying(false)
    }
  }
  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  if (authStatus === 'checking') {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-checking" role="status">
          正在连接森月居……
        </div>
      </div>
    )
  }

  if (authStatus === 'signedOut') {
    return (
      <AuthScreen
        authError={authError}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ProfileAvatar
            className="brand-mark"
            label={aiProfile.name}
            imageUrl={aiProfile.avatarUrl}
          />
          <div>
            <p className="brand-kicker">私人静室</p>
            <h1>森月居</h1>
          </div>
        </div>

        <button
          className="new-conversation"
          type="button"
          onClick={handleNewConversation}
          disabled={isLoadingSessions}
        >
          <span aria-hidden="true">＋</span>
          新建会话
        </button>

        <div className="conversation-heading">
          <span>会话</span>
          <span>{sessions.length}</span>
        </div>

        <nav className="conversation-nav" aria-label="会话列表">
          {isLoadingSessions ? (
            <p className="sidebar-loading">正在加载会话……</p>
          ) : sessions.length ? (
            <ol className="conversation-list">
              {sessions.map((session) => {
                const isActive = session.id === activeId

                return (
                  <li className="conversation-item" key={session.id}>
                    <button
                      className={`conversation-card${isActive ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => handleSelectSession(session.id)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="conversation-title">
                        {session.title}
                      </span>
                      <span className="conversation-preview">
                        {formatSessionTime(session.updated_at)}
                      </span>
                    </button>                      <div className="session-actions">
                        <button
                          className="session-action rename-session"
                          type="button"
                          onClick={() => handleRenameSession(session.id)}
                          aria-label={`重命名会话 ${session.title}`}
                          title="重命名会话"
                        >
                          ✎
                        </button>
                        <button
                          className="session-action delete-session"
                          type="button"
                          onClick={() => handleDeleteSession(session.id)}
                          aria-label={`删除会话 ${session.title}`}
                          title="删除会话"
                        >
                          ×
                        </button>
                      </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="sidebar-loading">还没有会话。</p>
          )}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-note">
            已登录：{user?.email ?? '当前用户'}
          </p>
          <button
            className={`settings-button${activeView === 'settings' ? ' is-active' : ''}`}
            type="button"
            onClick={() => {
              setActiveView('settings')
              setNotice('')
            }}
            aria-current={activeView === 'settings' ? 'page' : undefined}
          >
            设置
          </button>
          <button className="logout-button" type="button" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <main className="chat-panel">
      {activeView === 'settings' ? (
        <SettingsPanel
          error={settingsError}
          form={settingsForm}
          isLoading={isLoadingSettings}
          isPersisted={isSettingsPersisted}
          isSaving={isSavingSettings}
          message={settingsMessage}
          customProviderForm={customProviderForm}
          onCustomProviderChange={setCustomProviderForm}
          providerApiKey={providerApiKey}
          providerMessage={providerMessage}
          providerModels={providerModels}
          providers={providers}
          isConnectingProvider={isConnectingProvider}
          onProviderChange={handleProviderChange}
          onProviderKeyChange={setProviderApiKey}
          onConnectProvider={handleConnectProvider}
          onDisconnectProvider={handleDisconnectProvider}
          onRefreshModels={() => loadProviderModels(settingsForm.provider)}
          onBack={() => setActiveView('chat')}
          onChange={handleSettingsChange}
          onSubmit={handleSettingsSave}
        />
      ) : (
        <>
        <header className="chat-header">
          <div>
            <p className="chat-eyebrow">与枭的对话</p>
            <h2>{activeConversation?.title ?? '森月居'}</h2>
          </div>
          <div className="phase-status">
            <span className="status-dot" aria-hidden="true" />
            单次问答 · 后端持久化
          </div>
        </header>

        {notice && (
          <div className="app-notice" role="alert">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice('')}
              aria-label="关闭提示"
            >
              ×
            </button>
          </div>
        )}

        <section
          className="message-list"
          aria-label="消息区"
          aria-live="polite"
          role="log"
        >
          {isLoadingMessages ? (
            <div className="message-list-state" role="status">
              正在加载历史记录……
            </div>
          ) : messages.length ? (
            messages.map((message) => (
              <article
                  className={`message-row ${message.role}${message.pending ? ' is-pending' : ''}`}
                key={message.id}
              >
                <ProfileAvatar
                  className="message-avatar"
                  label={message.role === 'assistant' ? aiProfile.name : '你'}
                  imageUrl={
                    message.role === 'assistant' ? aiProfile.avatarUrl : null
                  }
                />
                <div className="message-content">
                  <div className="message-meta">
                    <span>{message.role === 'assistant' ? '枭' : '你'}</span>
                    <time>{formatMessageTime(message.created_at)}</time>
                  </div>
                  <div className="message-bubble">{message.content}</div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-conversation">
              <span aria-hidden="true">○</span>
              <h3>{activeId ? '湖面还没有涟漪' : '先创建一段会话'}</h3>
              <p>
                {activeId
                  ? '写下第一句话，这段会话便会从这里开始。'
                  : '点击左侧的新建会话，再写下第一句话。'}
              </p>
            </div>
          )}
          {isReplying && (
            <div className="reply-indicator" role="status">
              <span aria-hidden="true" />
              枭正在回应
            </div>
          )}
          <div ref={messagesEndRef} />
        </section>

        <section className="composer-zone" aria-label="消息输入区">
          <form
            className="composer"
            onSubmit={handleSend}
            aria-busy={isReplying}
          >
            <div className="composer-field">
              <label className="sr-only" htmlFor="message-input">
                给枭的消息
              </label>
              <textarea
                id="message-input"
                rows="1"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  activeId ? '写下此刻想说的话……' : '请先新建一个会话'
                }
                disabled={!activeId || isLoadingMessages || isReplying}
              />
              <span className="composer-hint">
                Enter 发送 · Shift + Enter 换行
              </span>
            </div>
            <button
              type="submit"
              disabled={!activeId || !draft.trim() || isReplying}
            >
              {isReplying ? '等待' : '发送'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="phase-note">
            会话和消息只保存在 Supabase；当前仍不保存长期记忆或多轮上下文。
          </p>
        </section>
        </>
      )}
      </main>
      {renameSession && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isRenaming) {
              setRenameSession(null)
              setRenameError('')
            }
          }}
        >
          <form className="rename-dialog" onSubmit={handleRenameSubmit}>
            <div className="rename-heading">
              <p className="chat-eyebrow">整理会话</p>
              <h3>重命名会话</h3>
            </div>

            <label className="rename-field">
              <span>会话名称</span>
              <input
                type="text"
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                maxLength="120"
                disabled={isRenaming}
                autoFocus
              />
            </label>

            {renameError && (
              <p className="rename-error" role="alert">
                {renameError}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="modal-cancel"
                type="button"
                disabled={isRenaming}
                onClick={() => {
                  setRenameSession(null)
                  setRenameError('')
                }}
              >
                取消
              </button>
              <button
                className="modal-save"
                type="submit"
                disabled={!renameDraft.trim() || isRenaming}
              >
                {isRenaming ? '保存中' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
