/**
 * Turns a chat message like "vegetables 150rs" into an expense.
 *
 * Pure and dependency-free: the SAME file ships in the frontend (live preview,
 * mock API) and the server (webhook), so what you see in the app's "Try it"
 * box is exactly what the bot does. Keep both copies identical — the shared
 * fixtures in tests/fixtures/parser-cases.json guard against drift.
 *
 * Philosophy: wrongly recording a chat message as an expense is worse than
 * missing one, so anything ambiguous is ignored.
 */

const CATEGORY_RULES = [
  ['vegetables', /\b(sabzi|sabji|veg|veggies?|vegetables?|fruits?|phal|onion|tomato|potato|aloo|bhaiya|mandi|coriander|banana|dhaniya)\b/i],
  ['milk', /\b(milk|doodh|curd|dahi|paneer|amul|butter ?milk|lassi)\b/i],
  ['utilities', /\b(electricity|bijli|gas|cylinder|lpg|wi-?fi|broadband|internet|recharge|water bill|paani)\b/i],
  ['cleaning', /\b(clean(er|ing)?|detergent|soap|mop|dish ?wash|phenyl|harpic|surf|scrub(bers?)?|broom|safai)\b/i],
  ['transport', /\b(auto|cab|uber|ola|rapido|bike taxi|metro|petrol|diesel|fuel|delivery)\b/i],
  ['maintenance', /\b(plumber|electrician|repair|service|ro|painter|carpenter|fix|mistri)\b/i],
  ['food', /\b(zomato|swiggy|pizza|biryani|lunch|dinner|brunch|tiffin|takeaway|restaurant|order|cafe|chai|momos?|burger|snack)\b/i],
  ['household', /\b(bulb|bucket|container|towel|can|cans|kitchen|utensil|mat|curtain|extension|hanger)\b/i],
  ['groceries', /\b(grocer(y|ies)|kirana|rashan|atta|rice|dal|pulses|oil|masala|spices|bread|eggs?|snacks|maggi|biscuits?|sugar|d-?mart|bigbasket|blinkit|zepto)\b/i],
]

export function guessCategory(text) {
  const t = String(text ?? '').trim()
  if (t.length < 2) return null
  const hit = CATEGORY_RULES.find(([, re]) => re.test(t))
  return hit ? hit[0] : null
}

const MAX_LENGTH = 200
const MAX_AMOUNT = 500000
const FILLER = new Set(['paid', 'pay', 'bought', 'buy', 'got', 'spent', 'spend', 'for', 'on', 'the', 'a', 'an', 'of', 'to', 'by', 'my', 'today', 'yesterday', 'just', 'rs', 'inr', 'rupees', 'rupee', 'only', 'expense', 'purchase', 'purchased', '-', ':', '=', '@'])
const NOISE_WORDS = /\b(will|shall|should|would|could|can you|tomorrow|later|tonight|remind|reminder|who|what|when|where|why|how|need|needs|please|pls|sent|send|sending|transfer(red)?|gpay|upi|phonepe|paytm|bhej|bheja|owe|owes|lol|haha|hehe|good morning|good night|good evening|hi|hello|hey|thanks|thank you|bye|happy birthday|congrats|congratulations)\b|['’]ll\b/i
const PRONOUNS = /\b(i|we|you|he|she|they|me|us|him|her|them|u)\b/i
const BEFORE_BLOCKERS = new Set(['at', 'by', 'till', 'until', 'after', 'before', 'room', 'flat', 'floor', 'house', 'no', 'no.', 'number', 'gate', 'block', 'sector', 'version', 'page', 'bhk', '#', 'tower', 'apt'])
const UNIT = /^(kg|kgs|g|gm|gms|l|ltr|ltrs|litre|litres|liter|liters|ml|pcs|pc|pack|packs|dozen|units?|people|persons?|min|mins|minutes?|hr|hrs|hours?|days?|km|kms|am|pm|st|nd|rd|th|x)$/i

/** "1,850" "1850" "150.50" "2k" "1.5k" → number, or null. */
function toAmount(raw) {
  const m = /^(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?(k)?$/i.exec(raw)
  if (!m) return null
  let n = Number(`${m[1].replace(/,/g, '')}${m[2] ? `.${m[2]}` : ''}`)
  if (m[3]) n *= 1000
  return n
}

const COMMANDS = [
  ['link', /^(?:link|connect)\s+([a-z0-9][a-z0-9-]{3,19})$/i],
  ['help', /^(?:help|\?|commands|hi roomly|hello roomly)$/i],
  ['balance', /^(?:balance|bal|owe|owes|settle|settlement|my balance)$/i],
  ['total', /^(?:total|spent|summary|month|this month)$/i],
  ['undo', /^(?:undo|delete last|remove last|cancel last)$/i],
]

/**
 * @param {string} input
 * @returns {{kind:'command',command:string,arg?:string}
 *   | {kind:'expense',amount:number,title:string,category:string|null,confidence:'high'|'medium',dayOffset:number}
 *   | {kind:'ignore',reason:string}}
 */
export function parseMessage(input) {
  const raw = String(input ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
  if (!raw) return { kind: 'ignore', reason: 'empty' }
  if (raw.length > MAX_LENGTH) return { kind: 'ignore', reason: 'too-long' }

  // Commands may be prefixed with ! or /
  const cmdText = raw.replace(/^[!/]\s*/, '')
  for (const [command, re] of COMMANDS) {
    const m = re.exec(cmdText)
    if (m) return m[1] ? { kind: 'command', command, arg: m[1].toUpperCase() } : { kind: 'command', command }
  }

  if (raw.includes('?')) return { kind: 'ignore', reason: 'question' }
  if (/\d{1,2}\s?:\s?\d{2}/.test(raw) || /\b\d{1,2}\s?(am|pm)\b/i.test(raw)) return { kind: 'ignore', reason: 'time' }
  if (/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/.test(raw) && !/₹|rs/i.test(raw)) return { kind: 'ignore', reason: 'date' }
  if (NOISE_WORDS.test(raw)) return { kind: 'ignore', reason: 'chatter' }

  // Tokenise, keeping a currency marker attached to its number: "₹150" "rs.150" "150rs" "150/-"
  const tokens = raw.split(' ')
  const items = tokens.map((tok, i) => {
    const t = tok.replace(/^[(\[]+|[)\],;!]+$/g, '')
    let m = /^(?:₹|rs\.?|inr)\s*(\S+?)\.?$/i.exec(t)
    if (m) { const a = toAmount(m[1]); if (a !== null) return { i, tok, amount: a, marked: true } }
    m = /^(\S+?)(?:\/-|₹|rs\.?|inr|rupees?)$/i.exec(t)
    if (m) { const a = toAmount(m[1]); if (a !== null) return { i, tok, amount: a, marked: true } }
    const a = toAmount(t.replace(/\.$/, ''))
    if (a !== null) return { i, tok, amount: a, marked: false }
    return { i, tok, amount: null }
  })

  // A number followed by a unit ("10 kg", "2 litres") is a quantity, not a price.
  const candidates = items.filter((x) => {
    if (x.amount === null) return false
    const next = items[x.i + 1]
    if (!x.marked && next && UNIT.test(next.tok.replace(/[^a-z]/gi, ''))) return false
    const prev = items[x.i - 1]
    if (prev && BEFORE_BLOCKERS.has(prev.tok.toLowerCase().replace(/[:,]$/, ''))) return false
    return true
  })
  if (candidates.length === 0) return { kind: 'ignore', reason: 'no-amount' }
  const marked = candidates.filter((c) => c.marked)
  const pool = marked.length ? marked : candidates
  if (pool.length > 1) return { kind: 'ignore', reason: 'ambiguous-amount' }
  const chosen = pool[0]
  if (!(chosen.amount >= 1) || chosen.amount > MAX_AMOUNT) return { kind: 'ignore', reason: 'amount-out-of-range' }

  // Everything else is the description.
  let dayOffset = 0
  const words = []
  for (const x of items) {
    if (x.i === chosen.i) continue
    const w = x.tok.replace(/^[^\p{L}\p{N}#]+|[^\p{L}\p{N}#]+$/gu, '')
    const lw = w.toLowerCase()
    if (lw === 'yesterday') { dayOffset = -1; continue }
    if (lw === 'today') continue
    if (!w || FILLER.has(lw) || /^(rs|inr|₹)$/i.test(w)) continue
    words.push(w)
  }
  if (words.length === 0) return { kind: 'ignore', reason: 'no-description' }
  if (words.length > 10) return { kind: 'ignore', reason: 'too-wordy' }

  const text = words.join(' ')
  const strict = words.length <= 4 && !PRONOUNS.test(text)
  const confident = strict || (chosen.marked && words.length <= 6 && !PRONOUNS.test(text))
  const title = (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 60)
  return {
    kind: 'expense', amount: Math.round(chosen.amount), title,
    category: guessCategory(text), confidence: confident ? 'high' : 'medium', dayOffset,
  }
}

/** Groups are noisy, so only high-confidence expenses are recorded there. */
export function shouldRecord(result, context = 'dm') {
  if (result.kind !== 'expense') return false
  return context === 'group' ? result.confidence === 'high' : true
}
