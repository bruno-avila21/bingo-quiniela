import { describe, it, expect } from 'vitest'
import { parseQuinielaHtml } from './scraper'
import { extractQuinielaNumber } from './validator'

const sampleHtml = `
<table class="tabla-resultados">
  <tr><td>1ro</td><td>7453</td></tr>
  <tr><td>2do</td><td>2291</td></tr>
  <tr><td>3ro</td><td>9607</td></tr>
  <tr><td>4to</td><td>0142</td></tr>
  <tr><td>5to</td><td>8800</td></tr>
</table>
`

describe('parseQuinielaHtml', () => {
  it('extracts raw prize numbers from HTML', () => {
    const results = parseQuinielaHtml(sampleHtml)
    expect(results).toContain('7453')
    expect(results).toContain('2291')
    expect(results).toHaveLength(5)
  })
})

describe('extractQuinielaNumber (from validator)', () => {
  it('extracts last 2 digits', () => {
    expect(extractQuinielaNumber('7453')).toBe(53)
    expect(extractQuinielaNumber('2291')).toBe(91)
  })

  it('returns null for 00', () => {
    expect(extractQuinielaNumber('8800')).toBeNull()
  })

  it('returns null for > 90', () => {
    expect(extractQuinielaNumber('2299')).toBeNull()
  })

  it('returns valid number for 42', () => {
    expect(extractQuinielaNumber('0142')).toBe(42)
  })
})
