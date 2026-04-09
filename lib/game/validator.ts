import type { BingoCard } from './card-generator'

export interface WinnerResult {
  hasLine: boolean
  hasFull: boolean
  winningRows: number[] // indices of completed rows
}

export function checkWinners(card: BingoCard, marks: number[]): WinnerResult {
  const markedSet = new Set(marks)
  const winningRows: number[] = []

  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const rowNumbers = card.rows[rowIdx].filter((n): n is number => n !== null)
    if (rowNumbers.every(n => markedSet.has(n))) {
      winningRows.push(rowIdx)
    }
  }

  const hasLine = winningRows.length > 0
  const hasFull = card.numbers.every(n => markedSet.has(n))

  return { hasLine, hasFull, winningRows }
}

// Extract valid numbers from quiniela result string
// e.g. "7453" → 53 (last 2 digits, must be 1-90)
export function extractQuinielaNumber(raw: string): number | null {
  const lastTwo = parseInt(raw.slice(-2), 10)
  if (lastTwo >= 1 && lastTwo <= 90) return lastTwo
  return null
}
