import { describe, it, expect } from 'vitest'
import { checkWinners } from './validator'
import type { BingoCard } from './card-generator'

const card: BingoCard = {
  numbers: [7, 23, 41, 62, 88, 15, 29, 44, 57, 73, 3, 36, 48, 65, 90],
  rows: [
    [7, null, 23, null, 41, null, 62, null, 88],
    [null, 15, 29, 44, null, 57, null, 73, null],
    [3, null, null, 36, 48, null, 65, null, 90],
  ],
}

describe('checkWinners', () => {
  it('returns no winner when no marks', () => {
    const result = checkWinners(card, [])
    expect(result.hasLine).toBe(false)
    expect(result.hasFull).toBe(false)
  })

  it('detects line when a full row is marked', () => {
    const marks = [7, 23, 41, 62, 88] // row 0 complete
    const result = checkWinners(card, marks)
    expect(result.hasLine).toBe(true)
    expect(result.hasFull).toBe(false)
  })

  it('does not detect line with partial row', () => {
    const marks = [7, 23, 41, 62] // row 0 missing 88
    const result = checkWinners(card, marks)
    expect(result.hasLine).toBe(false)
  })

  it('detects full card when all 15 numbers marked', () => {
    const result = checkWinners(card, card.numbers)
    expect(result.hasLine).toBe(true)
    expect(result.hasFull).toBe(true)
  })

  it('detects line in row 1', () => {
    const marks = [15, 29, 44, 57, 73]
    const result = checkWinners(card, marks)
    expect(result.hasLine).toBe(true)
  })
})
