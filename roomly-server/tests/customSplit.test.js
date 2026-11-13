import test from 'node:test'
import assert from 'node:assert/strict'
import { computeBalances } from '../src/utils/settlement.js'

test('custom allocations combine with equal-split expenses and balance to zero', () => {
  const expenses = [
    { amount: 100, paidBy: 'a', splitType: 'custom', splits: [{ memberId: 'a', amount: 60 }, { memberId: 'b', amount: 40 }] },
    { amount: 60, paidBy: 'b', splitType: 'equal', splits: [] },
  ]
  const result = computeBalances(expenses, ['a', 'b'])
  assert.equal(result.total, 160)
  assert.deepEqual(result.members, [
    { memberId: 'a', paid: 100, share: 90, balance: 10 },
    { memberId: 'b', paid: 60, share: 70, balance: -10 },
  ])
  assert.equal(result.members.reduce((sum, member) => sum + member.balance, 0), 0)
})
