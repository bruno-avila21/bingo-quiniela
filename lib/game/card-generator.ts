export interface BingoCard {
  numbers: number[]        // flat array of 15 numbers
  rows: (number | null)[][] // 3 rows × 9 cols, null = empty cell
}

// Column ranges: col 0 → 1-9, cols 1-7 → 10-79 (groups of 10), col 8 → 80-90
const COL_RANGES: [number, number][] = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
  [50, 59], [60, 69], [70, 79], [80, 90],
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickUnique(min: number, max: number, count: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

export function generateCard(): BingoCard {
  // Each column gets 1, 2, or 3 numbers, total must be 15 across 9 columns
  let counts: number[]
  do {
    counts = COL_RANGES.map(() => randomInt(1, 3))
  } while (counts.reduce((a, b) => a + b, 0) !== 15)

  // Pick numbers for each column
  const colNumbers: number[][] = COL_RANGES.map(([min, max], i) =>
    pickUnique(min, max, counts[i])
  )

  // Build 3×9 grid: distribute column numbers across 3 rows
  const grid: (number | null)[][] = [
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null),
  ]

  for (let col = 0; col < 9; col++) {
    const nums = colNumbers[col]
    const rowIndices = pickUnique(0, 2, nums.length)
    nums.forEach((num, i) => {
      grid[rowIndices[i]][col] = num
    })
  }

  // Verify each row has exactly 5 numbers; if not, retry
  const rowCounts = grid.map(row => row.filter(n => n !== null).length)
  if (!rowCounts.every(c => c === 5)) {
    return generateCard()
  }

  const numbers = colNumbers.flat()
  return { numbers, rows: grid }
}
