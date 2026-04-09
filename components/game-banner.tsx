interface GameBannerProps {
  jackpot: number
  lineAmount: number
  cardsSold: number
  cardPrice: number
}

export function GameBanner({ jackpot, lineAmount, cardsSold, cardPrice }: GameBannerProps) {
  return (
    <div className="bg-[#5c4a2a] text-white rounded-2xl p-8 text-center">
      <p className="text-sm uppercase tracking-widest opacity-75 mb-2">Pozo acumulado esta semana</p>
      <p className="text-5xl font-bold">${jackpot.toLocaleString('es-AR')}</p>
      <p className="mt-2 opacity-75 text-sm">Premio línea: ${lineAmount.toLocaleString('es-AR')}</p>
      <div className="mt-4 flex justify-center gap-8 text-sm">
        <span>{cardsSold} cartones vendidos</span>
        <span>Cartón: ${cardPrice.toLocaleString('es-AR')}</span>
      </div>
    </div>
  )
}
