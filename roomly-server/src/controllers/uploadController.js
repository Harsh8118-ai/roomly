import fs from 'node:fs/promises'
import path from 'node:path'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { randomToken } from '../services/tokenService.js'
import { env } from '../config/env.js'

export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR)
const MAX_BYTES = 5 * 1024 * 1024
// SVG is deliberately excluded — it can carry scripts.
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' }

/**
 * Stores a receipt image and returns its public URL.
 * To move to S3 / Cloudinary, replace the fs.writeFile below with a bucket upload and return that object's URL —
 * nothing else in the API or the frontend needs to change.
 */
export const uploadReceipt = asyncHandler(async (req, res) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(req.body.dataUrl)
  const ext = match && EXT[match[1].toLowerCase()]
  if (!match || !ext) throw ApiError.invalid('Please upload a JPG, PNG, WebP or HEIC image.')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length === 0) throw ApiError.invalid('That file couldn’t be read.')
  if (buffer.length > MAX_BYTES) throw ApiError.invalid('Receipts can be up to 5 MB.')

  const dir = path.join(UPLOAD_ROOT, String(req.household._id))
  await fs.mkdir(dir, { recursive: true })
  const file = `${randomToken(16)}.${ext}`
  await fs.writeFile(path.join(dir, file), buffer, { flag: 'wx' })
  res.status(201).json({ url: `${env.publicUrl}/uploads/${req.household._id}/${file}` })
})
