/**
 * Checks your WhatsApp Cloud API setup and tells you what's wrong in plain language.
 *
 *   npm run whatsapp:doctor
 *
 * It never prints secrets. Run it after changing credentials, and whenever messages stop arriving.
 */
import { pathToFileURL } from 'node:url'
import { env } from '../config/env.js'
import { graph, GraphError } from '../services/whatsapp/client.js'

const OK = '✓'; const BAD = '✗'; const WARN = '!'

export async function runDoctor() {
  const w = env.whatsapp
  const lines = []
  let failed = false
  const add = (mark, text) => { lines.push(`  ${mark} ${text}`); if (mark === BAD) failed = true }

  lines.push('Credentials')
  for (const [name, val] of [['WHATSAPP_ACCESS_TOKEN', w.token], ['WHATSAPP_PHONE_NUMBER_ID', w.phoneNumberId], ['WHATSAPP_APP_SECRET', w.appSecret], ['WHATSAPP_VERIFY_TOKEN', w.verifyToken]]) {
    add(val ? OK : BAD, `${name} ${val ? 'is set' : 'is missing'}`)
  }
  add(w.displayNumber ? OK : WARN, w.displayNumber ? 'WHATSAPP_DISPLAY_NUMBER is set (used for wa.me links and QR codes)' : 'WHATSAPP_DISPLAY_NUMBER is not set — the link QR code and “Open chat” button will be hidden')
  if (w.simulator) add(env.isProd ? BAD : WARN, 'WHATSAPP_SIMULATOR is on — fine for local development, must be off in production')

  if (w.configured) {
    lines.push('', 'Meta (live check)')
    try {
      const info = await graph('GET', `/${w.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`)
      add(OK, 'Access token works and can see this phone number')
      add(OK, `Number: ${info.display_phone_number ?? '?'} · Verified name: ${info.verified_name ?? '?'} · Quality: ${info.quality_rating ?? '?'}`)
      const shown = String(info.display_phone_number ?? '').replace(/\D/g, '')
      if (w.displayNumber && shown && shown !== w.displayNumber) add(WARN, `WHATSAPP_DISPLAY_NUMBER (${w.displayNumber}) doesn't match the number Meta reports (${shown})`)
      if (info.quality_rating === 'RED') add(WARN, 'Quality rating is RED — Meta may limit this number')
    } catch (e) {
      if (e instanceof GraphError && e.status === 401) add(BAD, 'Meta rejected the access token (expired or revoked). Create a permanent System User token — temporary tokens expire in about 24 hours.')
      else if (e instanceof GraphError && [400, 403, 404].includes(e.status)) add(BAD, `Meta says this token can't access phone number id ${w.phoneNumberId} (error ${e.code ?? e.status}). Check WHATSAPP_PHONE_NUMBER_ID, and that the token's system user has this WhatsApp account assigned.`)
      else add(BAD, 'Could not reach Meta right now. Check this server\'s internet access.')
    }
  }

  lines.push('', 'Your server')
  const url = `${env.publicUrl}/api/webhooks/whatsapp`
  add(env.isProd && !env.publicUrl.startsWith('https://') ? BAD : OK, `Webhook callback URL to paste into Meta: ${url}`)
  if (env.isProd && !env.publicUrl.startsWith('https://')) add(BAD, 'PUBLIC_URL must be https:// in production — Meta only calls secure URLs')
  add(OK, 'Verify token: the value of WHATSAPP_VERIFY_TOKEN (not printed)')
  add(OK, 'Subscribe the webhook to: messages' + (w.groupsEnabled ? ', group_lifecycle_update, group_participants_update, group_settings_update, group_status_update' : ''))
  if (w.groupsEnabled) add(WARN, 'Groups need an Official Business Account and are limited to 8 people per group; creation fails otherwise.')
  if (!env.clientOrigins.length) add(WARN, 'CLIENT_ORIGIN is empty — browsers will be blocked by CORS')

  lines.push('', failed ? 'Some checks failed — fix the ✗ items above, then run this again.' : 'Everything that can be checked from here looks good.')
  return { ok: !failed, report: lines.join('\n') }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runDoctor().then(({ ok, report }) => { console.log(report); process.exit(ok ? 0 : 1) })
}
