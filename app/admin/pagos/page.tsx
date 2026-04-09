import { createClient } from '@/lib/supabase/server'
import { TransferList } from '@/components/admin/transfer-list'

export default async function PagosPage() {
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from('payments')
    .select('id, card_id, transfer_img_url, created_at')
    .eq('method', 'transfer')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/comprobantes`

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">
        Transferencias pendientes ({pending?.length ?? 0})
      </h1>
      <TransferList transfers={pending ?? []} storageUrl={storageUrl} />
    </div>
  )
}
