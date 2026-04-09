import * as cheerio from 'cheerio'
import { extractQuinielaNumber } from './validator'

// Parse raw HTML from quiniela results page
// Returns array of raw prize strings (e.g. ["7453", "2291", ...])
export function parseQuinielaHtml(html: string): string[] {
  const $ = cheerio.load(html)
  const results: string[] = []

  $('table tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length >= 2) {
      const val = $(cells[1]).text().trim().replace(/\D/g, '')
      if (val.length >= 2) results.push(val)
    }
  })

  return results
}

// Fetch and parse quiniela results for a given date and source
export async function fetchQuinielaResults(params: {
  date: Date
  source: 'nacional' | 'provincial'
  scraperUrl: string
}): Promise<number[]> {
  const dateStr = params.date.toISOString().split('T')[0]

  let html: string
  try {
    const response = await fetch(`${params.scraperUrl}?date=${dateStr}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    html = await response.text()
  } catch (err) {
    throw new Error(`Scraper failed for ${params.source}: ${err}`)
  }

  const rawNumbers = parseQuinielaHtml(html)

  return rawNumbers
    .map(raw => extractQuinielaNumber(raw))
    .filter((n): n is number => n !== null)
}
