import { useEffect, useRef, useState } from 'react'
import './App.css'

const aiProfile = {
  name: '枭',
  avatarUrl: null,
}

const initialConversations = [
  {
    id: 'night-wind',
    title: '今夜的微风',
    preview: '若你愿意，就从这里开始。',
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: '晚上好。我是枭。森月居很安静，你可以慢慢说，我会在这里听。',
        time: '此刻',
      },
    ],
  },
  {
    id: 'still-lake',
    title: '湖面无声',
    preview: '把尚未说完的话留在这里。',
    messages: [
      {
        id: 'still-lake-welcome',
        role: 'assistant',
        content: '这里没有喧闹的事务。想说什么，都可以从一句话开始。',
        time: '昨夜',
      },
    ],
  },
  {
    id: 'old-book',
    title: '一段旧书',
    preview: '适合夜深时重读的段落。',
    messages: [
      {
        id: 'old-book-welcome',
        role: 'assistant',
        content: '有些句子适合隔着时间再看一遍。你想从哪里说起？',
        time: '昨日',
      },
    ],
  },
]

const getCurrentTime = () =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())

function ProfileAvatar({ className, label, imageUrl }) {
  return (
    <div className={className} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : label}
    </div>
  )
}

function App() {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeId, setActiveId] = useState(initialConversations[0].id)
  const [draft, setDraft] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const messagesEndRef = useRef(null)

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ??
    conversations[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [activeConversation?.messages.length, activeId])

  const handleNewConversation = () => {
    const id = `conversation-${Date.now()}`
    const newConversation = {
      id,
      title: '新的会话',
      preview: '等待你开口。',
      messages: [],
    }

    setConversations((current) => [newConversation, ...current])
    setActiveId(id)
    setDraft('')
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const text = draft.trim()

    if (!text || isReplying) {
      return
    }

    const conversationId = activeId
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      time: getCurrentTime(),
    }

    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }

        return {
          ...conversation,
          title:
            conversation.messages.length === 0
              ? text.slice(0, 12)
              : conversation.title,
          preview: text,
          messages: [...conversation.messages, userMessage],
        }
      }),
    )
    setDraft('')
    setIsReplying(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || typeof data.reply !== 'string') {
        throw new Error(data.error || '没有收到有效回应')
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        time: getCurrentTime(),
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                preview: assistantMessage.content,
                messages: [...conversation.messages, assistantMessage],
              }
            : conversation,
        ),
      )
    } catch (error) {
      const errorText =
        error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : '暂时没有收到回应。请确认后端服务已经启动后再试。'
      const errorMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: errorText,
        time: getCurrentTime(),
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                preview: errorMessage.content,
                messages: [...conversation.messages, errorMessage],
              }
            : conversation,
        ),
      )
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
        >
          <span aria-hidden="true">＋</span>
          新建会话
        </button>

        <div className="conversation-heading">
          <span>会话</span>
          <span>{conversations.length}</span>
        </div>

        <nav className="conversation-nav" aria-label="会话列表">
          <ol className="conversation-list">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId

              return (
                <li key={conversation.id}>
                  <button
                    className={`conversation-card${isActive ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="conversation-title">
                      {conversation.title}
                    </span>
                    <span className="conversation-preview">
                      {conversation.preview}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <p className="sidebar-note">本阶段不保存聊天记录</p>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <div>
            <p className="chat-eyebrow">与枭的对话</p>
            <h2>{activeConversation?.title ?? '森月居'}</h2>
          </div>
          <div className="phase-status">
            <span className="status-dot" aria-hidden="true" />
            单次问答 · 无记忆
          </div>
        </header>

        <section
          className="message-list"
          aria-label="消息区"
          aria-live="polite"
          role="log"
        >
          {activeConversation?.messages.length ? (
            activeConversation.messages.map((message) => (
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
                    <time>{message.time}</time>
                  </div>
                  <div className="message-bubble">{message.content}</div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-conversation">
              <span aria-hidden="true">○</span>
              <h3>湖面还没有涟漪</h3>
              <p>写下第一句话，这段会话便会从这里开始。</p>
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
                placeholder="写下此刻想说的话……"
              />
              <span className="composer-hint">
                Enter 发送 · Shift + Enter 换行
              </span>
            </div>
            <button type="submit" disabled={!draft.trim() || isReplying}>
              {isReplying ? '等待' : '发送'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="phase-note">
            每次只发送当前这一句话，不保存历史记录，也不使用数据库。
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
