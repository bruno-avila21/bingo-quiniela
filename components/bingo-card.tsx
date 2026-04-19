'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BingoCardProps {
  cardId: string
  rows: (number | null)[][]
  initialConfirmed?: number[]
  initialPending?: number[]
  gameId: string
}

export function BingoCard({ cardId, rows, initialConfirmed = [], initialPending = [], gameId }: BingoCardProps) {
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set(initialConfirmed))
  const [pending, setPending] = useState<Set<number>>(new Set(initialPending))
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
        const num = payload.new.number as number
        if (payload.new.validated) {
          setConfirmed(prev => new Set([...prev, num]))
          setPending(prev => { const next = new Set(prev); next.delete(num); return next })
        } else {
          setPending(prev => new Set([...prev, num]))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'card_marks',
        filter: `card_id=eq.${cardId}`,
      }, payload => {
        if (payload.new.validated) {
          const num = payload.new.number as number
          setConfirmed(prev => new Set([...prev, num]))
          setPending(prev => { const next = new Set(prev); next.delete(num); return next })
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'card_marks',
        filter: `card_id=eq.${cardId}`,
      }, payload => {
        const num = payload.old.number as number
        setPending(prev => { const next = new Set(prev); next.delete(num); return next })
        setConfirmed(prev => { const next = new Set(prev); next.delete(num); return next })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cardId, supabase])

  async function toggleMark(num: number) {
    if (confirmed.has(num)) return

    if (pending.has(num)) {
      setPending(prev => { const next = new Set(prev); next.delete(num); return next })
      await supabase.from('card_marks')
        .delete()
        .eq('card_id', cardId)
        .eq('number', num)
        .eq('validated', false)
    } else {
      setPending(prev => new Set([...prev, num]))
      const { error } = await supabase.from('card_marks')
        .insert({ card_id: cardId, number: num, validated: false })
      if (error) {
        setPending(prev => { const next = new Set(prev); next.delete(num); return next })
      }
    }
  }

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
                    <button
                      onClick={() => toggleMark(num)}
                      disabled={confirmed.has(num)}
                      className={`w-9 h-9 rounded flex items-center justify-center
                        font-bold text-sm select-none transition-colors
                        ${confirmed.has(num)
                          ? 'bg-[#8b7355] text-white cursor-default'
                          : pending.has(num)
                          ? 'bg-amber-300 text-amber-900 cursor-pointer hover:bg-amber-400'
                          : 'bg-[#ede8dc] text-[#5c4a2a] cursor-pointer hover:bg-[#e0d9cc]'
                        }`}
                    >
                      {num}
                    </button>
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
