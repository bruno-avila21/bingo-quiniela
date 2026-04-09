import { createPreference } from '@/lib/payments/mercadopago'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const pref = await createPreference(body)
  return NextResponse.json({ initPoint: pref.init_point })
}
