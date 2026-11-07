/** An error whose message is safe to show to the end user. */
export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.extra = extra
  }
  static badRequest(m = 'That request doesn’t look right.') { return new ApiError(400, m) }
  static unauthorized(m = 'Session expired') { return new ApiError(401, m) }
  static forbidden(m = 'You don’t have permission to do that.') { return new ApiError(403, m) }
  static notFound(m = 'Not found') { return new ApiError(404, m) }
  static conflict(m = 'That already exists.') { return new ApiError(409, m) }
  static invalid(m = 'Some details look off.') { return new ApiError(422, m) }
}
