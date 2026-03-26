import { createBrowserClient } from '@supabase/ssr'

// ─── Types ──────────────────────────────────────────────────

export type Entry = {
  id: string
  user_id: string
  date: string
  revenus: number
  accounts: Record<string, number>
  deposits: Record<string, number>
  created_at: string
  updated_at: string
}

export type UserAccount = {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export type EntryInsert = {
  date: string
  revenus: number
  accounts: Record<string, number>
  deposits: Record<string, number>
}

// ─── Client navigateur ───────────────────────────────────────

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Entries ─────────────────────────────────────────────────

export async function getEntries(): Promise<Entry[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertEntry(entry: EntryInsert): Promise<Entry> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data, error } = await supabase
    .from('entries')
    .upsert({ ...entry, user_id: user.id }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEntry(id: string, entry: Partial<EntryInsert>): Promise<Entry> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('entries')
    .update(entry)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEntry(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}

// ─── Comptes ─────────────────────────────────────────────────

export async function getUserAccounts(): Promise<UserAccount[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_accounts')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addUserAccount(name: string): Promise<UserAccount> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const accounts = await getUserAccounts()
  const { data, error } = await supabase
    .from('user_accounts')
    .insert({ name, user_id: user.id, position: accounts.length })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteUserAccount(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('user_accounts').delete().eq('id', id)
  if (error) throw error
}

// ─── Auth ────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: displayName } }
  })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })
  if (error) throw error
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}