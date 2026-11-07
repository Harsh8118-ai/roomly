import { CATEGORY_LABEL } from '../../constants.js'
import { formatINR } from '../../utils/format.js'

/** Everything the bot ever says. Short, friendly, no jargon. */
export const replies = {
  help: 'Send an expense like “vegetables 150” and I’ll add it.\nOther things I understand:\n• balance — what you owe or are owed\n• total — this month’s spend\n• undo — remove your last WhatsApp expense',
  linked: (firstName) => `✅ Linked! Hi ${firstName} — you can now log expenses here. Try: vegetables 150`,
  linkFailed: 'That code didn’t work. Open Roomly → Settings → WhatsApp for a fresh one.',
  linkRateLimited: 'Too many tries. Please wait a while, then get a fresh code in Roomly.',
  linkTaken: 'This number is already linked to a different Roomly account. Unlink it there first.',
  linkInGroup: 'Please send link codes to me in a private chat, not in the group.',
  unlinkedDm: 'I don’t know this number yet. Open Roomly → Settings → WhatsApp → Link my number.',
  unlinkedGroup: (name) => `${name}, I can’t tell who you are yet. In Roomly, open Settings → WhatsApp and link your number — then your messages count.`,
  noHousehold: 'Join or create a household in Roomly first, then I can add expenses.',
  added: ({ amount, category, name, dm }) => `✅ Added ${formatINR(amount)} · ${CATEGORY_LABEL[category] ?? 'Other'} · ${name}${dm ? '\nSend “undo” to remove it.' : ''}`,
  closed: (month) => `${month} is already settled, so I can’t add to it.`,
  undone: ({ title, amount }) => `↩️ Removed ${formatINR(amount)} for ${title}.`,
  undoNone: 'Nothing to undo — I only remove expenses you added from WhatsApp in the last 15 minutes.',
  undoClosed: (month) => `${month} is already settled, so I can’t change it.`,
  balance: (b) => (b > 0 ? `You should receive ${formatINR(b)} this month.` : b < 0 ? `You owe ${formatINR(-b)} this month.` : 'You’re all square this month.'),
  total: ({ month, total, count }) => `${month}: ${formatINR(total)} across ${count} expense${count === 1 ? '' : 's'}.`,
}
