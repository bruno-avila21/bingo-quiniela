import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import crypto from 'crypto'

function getClient() {
  return new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  })
}

export async function createPreference(params: {
  cardIds: string[]
  quantity: number
  unitPrice: number
  payerEmail: string
  externalReference: string
}) {
  const client = getClient()
  const preference = new Preference(client)

  const response = await preference.create({
    body: {
      items: [{
        id: 'bingo-card',
        title: `Cartón de Bingo x${params.quantity}`,
        quantity: params.quantity,
        unit_price: params.unitPrice,
        currency_id: 'ARS',
      }],
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL}/comprar/exito`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL}/comprar/error`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/mercadopago/webhook`,
    },
  })

  return response
}

export async function getPayment(paymentId: string) {
  const client = getClient()
  const payment = new Payment(client)
  return payment.get({ id: paymentId })
}

export function verifyWebhookSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string,
): boolean {
  if (!signature || !requestId) return false
  const secret = process.env.MP_WEBHOOK_SECRET!
  const tsMatch = signature.split(';').find(s => s.startsWith('ts='))
  if (!tsMatch) return false
  const ts = tsMatch.replace('ts=', '')
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  const receivedHash = signature.split(';').find((s: string) => s.startsWith('v1='))?.replace('v1=', '')
  return expectedHash === receivedHash
}
