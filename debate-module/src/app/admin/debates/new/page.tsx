import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DebateForm } from '@/components/admin/DebateForm'

export default async function NewDebatePage() {
  const supabase = await getSupabaseServerClient()
  const { data: themes } = await supabase
    .from('debate_themes')
    .select('*')
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Novo Debate</h1>
      <DebateForm themes={themes ?? []} />
    </div>
  )
}
