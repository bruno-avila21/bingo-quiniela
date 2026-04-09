'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BingoCardProps {
  cardId: string
  rows: (number | null)[][]
  initialMarks?: number[]
  gameId: string
}

export function BingoCard({ cardId, rows, initialMarks = [], gameId }: BingoCardProps) {
  const [marks, setMarks] = useState<Set<number>>(new Set(initialMarks))
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`card-marks-${cardId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'card_marks',
        filter: `card_id=eq.${cardId}`,
      }, payload => {
        setMarks(prev => new Set([...prev, payload.new.number]))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cardId, supabase])

  return (
    <div className="inline-block bg-[#f5f0e8] border-2 border-[#d4c5a9] rounded-xl p-3 shadow">
      <table className="border-collapse">
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((num, colIdx) => (
                <td key={colIdx} className="p-0.5">
                  {num === null ? (
                    <div className="w-9 h-9 rounded bg-[#f5f0e8]" />
                  ) : (
                    <div className={`w-9 h-9 rounded flex items-center justify-center
                      font-bold text-sm select-none transition-colors
                      ${marks.has(num)
                        ? 'bg-[#8b7355] text-white'
                        : 'bg-[#ede8dc] text-[#5c4a2a]'
                      }`}>
                      {num}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
