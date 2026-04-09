import { describe, it, expect } from 'vitest'
import { generateCard } from './card-generator'

describe('generateCard', () => {
  it('returns exactly 15 numbers', () => {
    const card = generateCard()
    expect(card.numbers).toHaveLength(15)
  })

  it('all numbers are between 1 and 90', () => {
    const card = generateCard()
    card.numbers.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(90)
    })
  })

  it('has no duplicate numbers', () => {
    const card = generateCard()
    const unique = new Set(card.numbers)
    expect(unique.size).toBe(15)
  })

  it('each row has exactly 5 numbers', () => {
    const card = generateCard()
    expect(card.rows[0].filter(n => n !== null)).toHaveLength(5)
    expect(card.rows[1].filter(n => n !== null)).toHaveLength(5)
    expect(card.rows[2].filter(n => n !== null)).toHaveLength(5)
  })

  it('numbers in column 0 are between 1-9', () => {
    for (let i = 0; i < 20; i++) {
      const card = generateCard()
      card.rows.forEach(row => {
        if (row[0] !== null) {
          expect(row[0]).toBeGreaterThanOrEqual(1)
          expect(row[0]).toBeLessThanOrEqual(9)
        }
      })
    }
  })

  it('numbers in column 8 are between 80-90', () => {
    for (let i = 0; i < 20; i++) {
      const card = generateCard()
      card.rows.forEach(row => {
        if (row[8] !== null) {
          expect(row[8]).toBeGreaterThanOrEqual(80)
          expect(row[8]).toBeLessThanOrEqual(90)
        }
      })
    }
  })

  it('generates different cards each time', () => {
    const a = generateCard()
    const b = generateCard()
    expect(a.numbers).not.toEqual(b.numbers)
  })
})
