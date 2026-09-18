import express from 'express'

const app = express()
const port = Number(process.env.PORT) || 3000

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
    modelConnected: false,
    databaseConnected: false,
    memoryEnabled: false,
  })
})

app.post('/api/chat', (request, response) => {
  const message =
    typeof request.body?.message === 'string' ? request.body.message.trim() : ''

  if (!message) {
    response.status(400).json({
      error: '消息不能为空',
    })
    return
  }

  response.json({
    reply:
      '我听见了。当前只验证最小的一问一答，枭还没有连接语言模型，所以这句话暂时由占位回应代替。',
  })
})

app.use((_request, response) => {
  response.status(404).json({
    error: '未找到该接口',
  })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`森月居后端已启动：http://localhost:${port}`)
})
