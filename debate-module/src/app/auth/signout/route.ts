import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(`${origin}/debates`, { status: 303 })
}
