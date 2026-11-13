import fs from 'node:fs'
import { createApp } from './app.js'
import { connectDb, disconnectDb } from './config/db.js'
import { env } from './config/env.js'
import { UPLOAD_ROOT } from './controllers/uploadController.js'
import { Household, User, Expense, SettlementPayment, Notification, WhatsappLink, WhatsappLinkCode, WhatsappGroup, WhatsappMessage, ChatImport, ImportedMessage } from './models/index.js'

async function main() {
  await connectDb()
  // Make sure indexes (unique email, invite code, TTL, …) exist before taking traffic.
  await Promise.all([User, Household, Expense, SettlementPayment, Notification, WhatsappLink, WhatsappLinkCode, WhatsappGroup, WhatsappMessage, ChatImport, ImportedMessage].map((m) => m.init()))
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true })

  const server = createApp().listen(env.PORT, () => {
    console.log(`Roomly API listening on http://localhost:${env.PORT}/api  (${env.NODE_ENV})`)
  })

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down`)
    server.close(async () => { await disconnectDb(); process.exit(0) })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => { console.error('Failed to start:', err.message); process.exit(1) })
