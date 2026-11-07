/** Draws a tiny fake paper receipt as an SVG data-URL so demo expenses have real-looking attachments. */
export function receiptSvg(title: string, amount: number, date: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const lines = [0.38, 0.22, 0.31, 0.18, 0.27].map((w, i) => {
    const y = 150 + i * 26
    return `<rect x="28" y="${y}" width="${Math.round(w * 240)}" height="7" rx="3.5" fill="#d9d9d2"/><rect x="224" y="${y}" width="${28 + i * 4}" height="7" rx="3.5" fill="#d9d9d2"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="400" viewBox="0 0 280 400"><rect width="280" height="400" fill="#efefe9"/><path d="M20 16h240v360l-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8Z" fill="#fff" stroke="#e3e3dc"/><text x="140" y="56" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="15" font-weight="700" fill="#1c1c1c">TAX INVOICE</text><text x="140" y="76" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#8a8a84">${esc(title.slice(0, 28))}</text><text x="140" y="96" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#8a8a84">${date}</text><line x1="28" y1="116" x2="252" y2="116" stroke="#e3e3dc" stroke-dasharray="3 3"/>${lines}<line x1="28" y1="296" x2="252" y2="296" stroke="#e3e3dc" stroke-dasharray="3 3"/><text x="28" y="326" font-family="Helvetica,Arial,sans-serif" font-size="12" font-weight="700" fill="#1c1c1c">TOTAL</text><text x="252" y="326" text-anchor="end" font-family="Helvetica,Arial,sans-serif" font-size="14" font-weight="700" fill="#1c1c1c">₹${amount.toLocaleString('en-IN')}</text><text x="140" y="352" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="9" fill="#a3a39d">Thank you — visit again</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
