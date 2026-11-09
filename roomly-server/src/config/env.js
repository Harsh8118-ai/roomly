import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/roomly'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PUBLIC_URL: z.string().default('http://localhost:5000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Roomly <no-reply@roomly.app>'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional().refine((value) => !value || new URL(value).pathname === '/api/auth/google/callback', 'GOOGLE_REDIRECT_URI path must be /api/auth/google/callback'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_DISPLAY_NUMBER: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default('v23.0'),
  WHATSAPP_GROUPS_ENABLED: z.enum(['true', 'false']).default('false'),
  WHATSAPP_SIMULATOR: z.enum(['true', 'false']).default('false'),
})
const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const i of parsed.error.issues) console.error(`  ${i.path.join('.')}: ${i.message}`)
  process.exit(1)
}
const d = parsed.data
const blank = (v) => (v && v.trim() ? v.trim() : undefined)
const whatsapp = {
  token: blank(d.WHATSAPP_ACCESS_TOKEN), phoneNumberId: blank(d.WHATSAPP_PHONE_NUMBER_ID),
  appSecret: blank(d.WHATSAPP_APP_SECRET), verifyToken: blank(d.WHATSAPP_VERIFY_TOKEN),
  displayNumber: blank(d.WHATSAPP_DISPLAY_NUMBER)?.replace(/\D/g, ''),
  graphVersion: d.WHATSAPP_GRAPH_VERSION, groupsEnabled: d.WHATSAPP_GROUPS_ENABLED === 'true',
  simulator: d.WHATSAPP_SIMULATOR === 'true',
}
whatsapp.configured = !!(whatsapp.token && whatsapp.phoneNumberId && whatsapp.appSecret && whatsapp.verifyToken)
whatsapp.enabled = whatsapp.configured || whatsapp.simulator
const given = [whatsapp.token, whatsapp.phoneNumberId, whatsapp.appSecret, whatsapp.verifyToken].filter(Boolean).length
if (given > 0 && given < 4 && d.NODE_ENV !== 'test') console.warn('[whatsapp] Incomplete credentials; WhatsApp stays disabled.')
if (whatsapp.simulator && d.NODE_ENV === 'production') {
  console.error('WHATSAPP_SIMULATOR must never be enabled in production.')
  process.exit(1)
}
export const env = {
  ...d, whatsapp, isProd: d.NODE_ENV === 'production', isTest: d.NODE_ENV === 'test',
  clientOrigins: d.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  publicUrl: d.PUBLIC_URL.replace(/\/$/, ''),
  google: { clientId: blank(d.GOOGLE_CLIENT_ID), clientSecret: blank(d.GOOGLE_CLIENT_SECRET), redirectUri: blank(d.GOOGLE_REDIRECT_URI) },
}
