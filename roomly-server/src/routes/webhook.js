import express from 'express'
import { receive, verify, verifySignature } from '../controllers/webhookController.js'

const router = express.Router()

router.get('/', verify)
// The raw bytes are needed to check Meta's signature, so keep them alongside the parsed JSON.
router.post('/', express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf } }), verifySignature, receive)

export default router
