import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bingo Quiniela <no-reply@tu-dominio.com>'

export async function sendCardEmail(params: {
  to: string
  cardNumbers: number[]
  gameWeek: string
}) {
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Tu cartón de Bingo está listo',
    html: `
      <h2>¡Tu cartón de bingo para la semana del ${params.gameWeek}!</h2>
      <p>Números: <strong>${params.cardNumbers.join(', ')}</strong></p>
      <p>Los resultados se validan cada noche con la quiniela nocturna.</p>
      <p>Podés ver tu cartón en <a href="${process.env.NEXT_PUBLIC_BASE_URL}/mis-cartones">Mis Cartones</a></p>
    `,
  })
}

export async function sendWinnerEmail(to: string, type: 'line' | 'full', amount: number) {
  const label = type === 'line' ? '¡Completaste una línea!' : '¡BINGO! Cartón completo'
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${label}`,
    html: `
      <h2>${label}</h2>
      <p>Tu premio: <strong>$${amount.toLocaleString('es-AR')}</strong></p>
      <p>Nos pondremos en contacto para coordinar el pago.</p>
    `,
  })
}

export async function sendAdminAlert(message: string) {
  await resend.emails.send({
    from: FROM,
    to: process.env.ADMIN_EMAIL!,
    subject: 'Alerta Bingo Quiniela',
    html: `<p>${message}</p>`,
  })
}
