import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export const signToken = (user) => jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0 }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
export const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET)

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
