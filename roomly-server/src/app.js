import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { UPLOAD_ROOT } from './controllers/uploadController.js'
import webhookRoutes from './routes/webhook.js'

export function createApp() {
  const app = express()
  // Behind nginx / a load balancer, trust the first proxy so rate limiting sees real client IPs.
  if (env.isProd) app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({
    origin(origin, cb) { cb(null, !origin || env.clientOrigins.includes(origin)) },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }))
  // Server-Sent Events must not be buffered by gzip.
  app.use(compression({ filter: (req, res) => (req.path === '/api/events' ? false : compression.filter(req, res)) }))
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'))

  // Meta's webhook: signature-verified, and exempt from the per-IP limiter (all traffic comes from Meta).
  app.use('/api/webhooks/whatsapp', webhookRoutes)

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.isTest, message: { message: 'Too many requests. Slow down a little.' } }))

  // Binary-sized text exports are sent as JSON to the import endpoint. Keep this limit scoped to imports.
  app.use('/api/imports', express.json({ limit: '12mb' }))

  // Receipt uploads arrive as base64 JSON, so that one route gets a bigger body limit.
  app.use('/api/uploads', express.json({ limit: '8mb' }))
  app.use(express.json({ limit: '100kb' }))

  // Uploaded receipts: unguessable file names, served as inert images.
  app.use('/uploads', express.static(UPLOAD_ROOT, {
    index: false, dotfiles: 'deny', immutable: true, maxAge: '30d',
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    },
  }))

  app.use('/api', routes)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
