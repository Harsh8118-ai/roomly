import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Household } from '../models/Household.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { verifyToken } from '../services/tokenService.js'

/** Requires a valid Bearer token and attaches `req.user`. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw ApiError.unauthorized()
  let payload
  try { payload = verifyToken(token) } catch { throw ApiError.unauthorized() }
  if (!mongoose.isValidObjectId(payload.sub)) throw ApiError.unauthorized()
  const user = await User.findById(payload.sub)
  if (!user || (user.tokenVersion ?? 0) !== (payload.tv ?? 0)) throw ApiError.unauthorized()
  req.user = user
  next()
})

/**
 * Loads the user's current household and confirms they belong to it.
 * Attaches `req.household` and `req.member`.
 */
export const requireHousehold = asyncHandler(async (req, _res, next) => {
  const id = req.user.currentHouseholdId
  if (!id) throw ApiError.notFound('You’re not in a household yet.')
  const household = await Household.findById(id)
  const member = household?.members.id(req.user._id)
  if (!household || !member) throw ApiError.forbidden()
  req.household = household
  req.member = member
  next()
})

export const requireAdmin = (req, _res, next) => {
  if (req.member?.role !== 'admin') return next(ApiError.forbidden('Only admins can do that.'))
  next()
}
