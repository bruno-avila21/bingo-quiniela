import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('comprobante') as File
  const cardIds = (formData.get('cardIds') as string).split(',')
  const gameId = formData.get('gameId') as string

  if (!file || !cardIds.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const filename = `transfers/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('comprobantes')
    .upload(filename, file, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  await supabase.from('payments').insert(
    cardIds.map(id => ({
      card_id: id,
      method: 'transfer',
      status: 'pending',
      transfer_img_url: uploadData.path,
    }))
  )

  return NextResponse.json({ ok: true, message: 'Comprobante recibido. Se activará cuando lo aprobemos.' })
}
