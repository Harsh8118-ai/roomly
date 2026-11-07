import type { LucideIcon } from 'lucide-react'
import {
  ShoppingBasket, Carrot, Milk, UtensilsCrossed, SprayCan,
  Armchair, Zap, Car, Wrench, Shapes,
} from 'lucide-react'
import type { CategoryId } from '@/types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  icon: LucideIcon
  hint: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'groceries', label: 'Groceries', icon: ShoppingBasket, hint: 'Atta, dal, oil, snacks' },
  { id: 'vegetables', label: 'Vegetables', icon: Carrot, hint: 'Sabzi, fruits' },
  { id: 'milk', label: 'Milk', icon: Milk, hint: 'Milk, curd, paneer' },
  { id: 'food', label: 'Food', icon: UtensilsCrossed, hint: 'Takeaway, tiffin, dining' },
  { id: 'cleaning', label: 'Cleaning', icon: SprayCan, hint: 'Detergent, mop, soap' },
  { id: 'household', label: 'Household', icon: Armchair, hint: 'Bulbs, buckets, kitchenware' },
  { id: 'utilities', label: 'Utilities', icon: Zap, hint: 'Electricity, gas, Wi-Fi' },
  { id: 'transport', label: 'Transport', icon: Car, hint: 'Auto, cab, delivery' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, hint: 'Repairs, plumber, RO service' },
  { id: 'other', label: 'Other', icon: Shapes, hint: 'Anything else' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryMeta>

/** Brand-led chart colours, in order of prominence. */
export const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6']
export const chartColor = (i: number) => `rgb(var(${CHART_VARS[Math.min(i, CHART_VARS.length - 1)]}))`
