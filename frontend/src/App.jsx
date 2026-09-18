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

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
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
  const accessTokenRef = useRef('')
  const messagesEndRef = useRef(null)

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

  useEffect(() => {
    void refreshSession()
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') {
      void loadSessions()
    }
  }, [authStatus])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages.length, activeId])

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

  const handleDeleteSession = async (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId)

    if (!session || !window.confirm(`删除“${session.title}”及全部消息？`)) {
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
        if (remaining[0]) {
          await loadMessages(remaining[0].id)
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
        setNotice(data.error || '消息发送失败，请稍后重试。')
        await loadMessages(sessionId)
        return
      }

      setMessages((current) => [
        ...current,
        data.userMessage,
        data.assistantMessage,
      ])
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
      setNotice(
        error instanceof Error ? error.message : '消息发送失败，请稍后重试。',
      )
      await loadMessages(sessionId)
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
                    </button>
                    <button
                      className="delete-session"
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      aria-label={`删除会话 ${session.title}`}
                      title="删除会话"
                    >
                      ×
                    </button>
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
          <button className="logout-button" type="button" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <main className="chat-panel">
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
                className={`message-row ${message.role}`}
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
                disabled={!activeId || isLoadingMessages}
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
      </main>
    </div>
  )
}

export default App
