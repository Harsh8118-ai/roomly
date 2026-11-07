import { ZodError } from 'zod'
import mongoose from 'mongoose'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'

export const notFoundHandler = (_req, res) => res.status(404).json({ message: 'Not found' })

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) return res.status(err.status).json({ message: err.message, ...err.extra })

  if (err instanceof ZodError) {
    const issue = err.issues[0]
    return res.status(422).json({ message: issue?.message ?? 'Some details look off.', field: issue?.path?.join('.') })
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(422).json({ message: Object.values(err.errors)[0]?.message ?? 'Some details look off.' })
  }
  if (err instanceof mongoose.Error.CastError) return res.status(404).json({ message: 'Not found' })
  if (err?.code === 11000) return res.status(409).json({ message: 'That already exists.' })
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'That file is too large.' })
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'That request couldn’t be read.' })
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') return res.status(401).json({ message: 'Session expired' })

  if (!env.isTest) console.error(`[error] ${req.method} ${req.originalUrl}`, err)
  res.status(500).json({ message: 'Something went wrong.' })
}
