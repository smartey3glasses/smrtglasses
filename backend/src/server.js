import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getMockTelemetry } from './mockTelemetry.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim())

app.disable('x-powered-by')
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'smart-glasses-monitoring-api', timestamp: new Date().toISOString() })
})

app.get('/api/telemetry', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getMockTelemetry())
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' })
})

app.use((error, _req, res, _next) => {
  const status = error.status || 500
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message })
})

app.listen(port, () => {
  process.stdout.write(`Smart Glasses Monitoring API listening on port ${port}\n`)
})
