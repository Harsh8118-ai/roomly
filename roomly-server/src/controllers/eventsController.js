import { subscribe } from '../services/events.js'

/** GET /api/events — one long-lived stream per open tab. */
export function stream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // tell nginx not to buffer
  })
  res.write('retry: 3000\n\n')

  const off = subscribe(req.household._id, (event) => res.write(`data: ${JSON.stringify(event)}\n\n`))
  if (!off) { res.write('event: busy\ndata: {}\n\n'); return res.end() }

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)
  const close = () => { clearInterval(heartbeat); off() }
  req.on('close', close)
  res.on('error', close)
}
