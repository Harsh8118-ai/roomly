import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireAdmin, requireHousehold } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { env } from '../config/env.js'
import * as v from '../validators/schemas.js'
import * as auth from '../controllers/authController.js'
import * as households from '../controllers/householdController.js'
import * as expenses from '../controllers/expenseController.js'
import * as settlements from '../controllers/settlementController.js'
import * as notifications from '../controllers/notificationController.js'
import { uploadReceipt } from '../controllers/uploadController.js'
import * as whatsapp from '../controllers/whatsappController.js'
import { stream } from '../controllers/eventsController.js'

const router = Router()
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.isTest })
const joinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.isTest, message: { message: 'Too many invite-code attempts. Try again in a few minutes.' } })

router.get('/health', (_req, res) => res.json({ ok: true, service: 'roomly-api', whatsapp: env.whatsapp.configured ? 'configured' : env.whatsapp.simulator ? 'simulator' : 'off', time: new Date().toISOString() }))

// Google OAuth is the only interactive sign-in method.
router.get('/auth/google', authLimiter, auth.googleStart)
router.get('/auth/google/callback', authLimiter, auth.googleCallback)
router.post('/auth/logout', auth.logout)
router.get('/auth/me', authenticate, auth.me)
router.patch('/auth/me', authenticate, validate({ body: v.profileBody }), auth.updateMe)

router.get('/households', authenticate, households.list)
router.post('/households', authenticate, validate({ body: v.householdNameBody }), households.create)
router.post('/households/join', authenticate, joinLimiter, validate({ body: v.joinBody }), households.join)
router.put('/households/current', authenticate, validate({ body: v.switchBody }), households.switchCurrent)

const inHousehold = [authenticate, requireHousehold]
router.get('/households/current', ...inHousehold, households.getCurrent)
router.patch('/households/current', ...inHousehold, requireAdmin, validate({ body: v.householdNameBody }), households.rename)
router.post('/households/current/invite-code', ...inHousehold, requireAdmin, households.regenerateCode)
router.get('/households/current/members', ...inHousehold, households.members)
router.post('/households/current/invites', ...inHousehold, validate({ body: v.inviteBody }), households.invite)
router.delete('/households/current/members/me', ...inHousehold, households.leave)
router.delete('/households/current/members/:memberId', ...inHousehold, requireAdmin, households.removeMember)

router.get('/expenses', ...inHousehold, validate({ query: v.expenseQuery }), expenses.list)
router.post('/expenses', ...inHousehold, validate({ body: v.expenseBody }), expenses.create)
router.get('/expenses/:id', ...inHousehold, expenses.get)
router.patch('/expenses/:id', ...inHousehold, validate({ body: v.expensePatchBody }), expenses.update)
router.delete('/expenses/:id', ...inHousehold, expenses.remove)
router.post('/expenses/:id/restore', ...inHousehold, validate({ body: v.restoreBody }), expenses.restore)
router.post('/uploads/receipts', ...inHousehold, validate({ body: v.receiptBody }), uploadReceipt)

router.get('/settlements/:month', ...inHousehold, validate({ params: v.monthParam }), settlements.settlement)
router.post('/settlements/:month/transactions/:tx/pay', ...inHousehold, validate({ params: v.monthParam }), settlements.markPaid)
router.delete('/settlements/:month/transactions/:tx/pay', ...inHousehold, validate({ params: v.monthParam }), settlements.markUnpaid)
router.get('/summaries/:month', ...inHousehold, validate({ params: v.monthParam }), settlements.summary)
router.get('/months', ...inHousehold, settlements.months)

router.get('/whatsapp/status', ...inHousehold, whatsapp.status)
router.post('/whatsapp/link-code', ...inHousehold, whatsapp.linkCode)
router.delete('/whatsapp/link', ...inHousehold, whatsapp.unlink)
router.post('/whatsapp/group', ...inHousehold, requireAdmin, whatsapp.group.create)
router.delete('/whatsapp/group', ...inHousehold, requireAdmin, whatsapp.group.remove)
router.post('/whatsapp/group/invite-link', ...inHousehold, requireAdmin, whatsapp.group.resetInvite)
router.patch('/whatsapp/settings', ...inHousehold, requireAdmin, validate({ body: v.whatsappSettingsBody }), whatsapp.settings)
router.get('/whatsapp/activity', ...inHousehold, whatsapp.activity)
router.post('/whatsapp/parse', ...inHousehold, validate({ body: v.whatsappParseBody }), whatsapp.parse)
router.post('/whatsapp/simulate', ...inHousehold, validate({ body: v.whatsappSimulateBody }), whatsapp.simulate)

router.get('/events', ...inHousehold, stream)
router.get('/notifications', ...inHousehold, notifications.list)
router.post('/notifications/read-all', ...inHousehold, notifications.markAllRead)
router.post('/notifications/:id/read', ...inHousehold, notifications.markRead)

export default router
