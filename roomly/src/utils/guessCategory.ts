import type { CategoryId } from '@/types'

const RULES: [CategoryId, RegExp][] = [
  ['vegetables', /\b(sabzi|sabji|veg|veggies?|vegetables?|fruits?|onion|tomato|potato|aloo|bhaiya|mandi|coriander|banana)\b/i],
  ['milk', /\b(milk|doodh|curd|dahi|paneer|amul|butter ?milk|lassi)\b/i],
  ['utilities', /\b(electricity|bijli|gas|cylinder|lpg|wi-?fi|broadband|internet|recharge|water bill)\b/i],
  ['cleaning', /\b(clean(er|ing)?|detergent|soap|mop|dish ?wash|phenyl|harpic|surf|scrub(bers?)?|broom)\b/i],
  ['transport', /\b(auto|cab|uber|ola|rapido|bike taxi|metro|petrol|fuel|delivery)\b/i],
  ['maintenance', /\b(plumber|electrician|repair|service|ro |painter|carpenter|fix)\b/i],
  ['food', /\b(zomato|swiggy|pizza|biryani|lunch|dinner|brunch|tiffin|takeaway|restaurant|order|cafe|chai|momos?)\b/i],
  ['household', /\b(bulb|bucket|container|towel|can|cans|kitchen|utensil|mat|curtain|extension|hanger)\b/i],
  ['groceries', /\b(grocer(y|ies)|kirana|atta|rice|dal|pulses|oil|masala|spices|bread|eggs?|snacks|maggi|biscuits?|sugar|d-?mart|bigbasket|blinkit|zepto)\b/i],
]

/** Tiny keyword model so "Sabzi mandi run" lands in Vegetables without a tap. */
export function guessCategory(title: string): CategoryId | null {
  const t = title.trim()
  if (t.length < 3) return null
  return RULES.find(([, re]) => re.test(t))?.[0] ?? null
}
