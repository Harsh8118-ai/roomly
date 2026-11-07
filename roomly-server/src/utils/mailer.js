import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let transport
const getTransport = () => {
  if (!env.SMTP_HOST) return null
  transport ??= nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined })
  return transport
}

/** Sends via SMTP when configured; otherwise logs the message so local development still works. */
export async function sendMail({ to, subject, text }) {
  const t = getTransport()
  if (!t) {
    if (!env.isTest) console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${text}\n`)
    return
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, text })
}
