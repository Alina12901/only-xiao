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
    phase: '第一阶段：静态界面',
    modelConnected: false,
    databaseConnected: false,
    memoryEnabled: false,
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

