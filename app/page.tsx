'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  getEntries, getUserAccounts, upsertEntry, updateEntry,
  deleteEntry, addUserAccount, deleteUserAccount, signOut, getUser,
  type Entry, type UserAccount
} from '@/lib/supabase'

const COLORS = ['#7F77DD', '#1D9E75', '#BA7517', '#993556', '#378ADD', '#639922']
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

const getTotal = (e: Entry) =>
  Object.values(e.accounts || {}).reduce((s, v) => s + (Number(v) || 0), 0)

const getLabel = (date: string) => {
  const [y, m] = date.split('-')
  return `${MONTHS[Number(m) - 1]} '${y.slice(2)}`
}

const nowMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type View = 'dashboard' | 'add' | 'history' | 'settings'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [view, setView] = useState<View>('dashboard')
  const [entries, setEntries] = useState<Entry[]>([])
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 's' | 'e' } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ date: string; revenus: string; accounts: Record<string, string> }>({
    date: nowMonth(), revenus: '', accounts: {}
  })
  const [newAccName, setNewAccName] = useState('')

  useEffect(() => {
    async function init() {
      const u = await getUser()
      if (!u) { router.push('/login'); return }
      setUser(u)
      const [e, a] = await Promise.all([getEntries(), getUserAccounts()])
      setEntries(e)
      setAccounts(a)
      setLoading(false)
    }
    init()
  }, [])

  function showToast(msg: string, type: 's' | 'e' = 's') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function initForm(entry?: Entry) {
    if (entry) {
      setEditId(entry.id)
      const accs: Record<string, string> = {}
      accounts.forEach(a => { accs[a.name] = String(entry.accounts?.[a.name] ?? '') })
      setForm({ date: entry.date, revenus: String(entry.revenus || ''), accounts: accs })
    } else {
      setEditId(null)
      const accs: Record<string, string> = {}
      accounts.forEach(a => { accs[a.name] = '' })
      setForm({ date: nowMonth(), revenus: '', accounts: accs })
    }
  }

  function navTo(v: View, entry?: Entry) {
    if (v === 'add') initForm(entry)
    setView(v)
  }

  async function handleSave() {
    if (!form.date) return showToast('Sélectionnez une date', 'e')
    if (!form.revenus) return showToast('Saisissez vos revenus', 'e')
    const accs: Record<string, number> = {}
    accounts.forEach(a => { accs[a.name] = Number(form.accounts[a.name] || 0) })
    try {
      if (editId) {
        const updated = await updateEntry(editId, { date: form.date, revenus: Number(form.revenus), accounts: accs })
        setEntries(prev => prev.map(e => e.id === editId ? updated : e))
        showToast('Entrée mise à jour')
      } else {
        const created = await upsertEntry({ date: form.date, revenus: Number(form.revenus), accounts: accs })
        setEntries(prev => [...prev, created])
        showToast('Entrée enregistrée')
      }
      setView('history')
    } catch {
      showToast('Erreur lors de la sauvegarde', 'e')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      showToast('Entrée supprimée')
    } catch {
      showToast('Erreur lors de la suppression', 'e')
    }
  }

  async function handleAddAccount() {
    if (!newAccName.trim()) return showToast('Nom invalide', 'e')
    if (accounts.find(a => a.name === newAccName.trim())) return showToast('Compte déjà existant', 'e')
    try {
      const created = await addUserAccount(newAccName.trim())
      setAccounts(prev => [...prev, created])
      setNewAccName('')
      showToast(`"${created.name}" ajouté`)
    } catch {
      showToast('Erreur', 'e')
    }
  }

  async function handleDeleteAccount(id: string, name: string) {
    if (accounts.length <= 1) return showToast('Minimum 1 compte requis', 'e')
    try {
      await deleteUserAccount(id)
      setAccounts(prev => prev.filter(a => a.id !== id))
      showToast(`"${name}" supprimé`)
    } catch {
      showToast('Erreur', 'e')
    }
  }

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
      <div className="text-sm text-neutral-400">Chargement…</div>
    </div>
  )

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const cur = latest ? getTotal(latest) : 0
  const prv = prev ? getTotal(prev) : 0
  const varAbs = cur - prv
  const varPct = prv ? varAbs / prv * 100 : 0
  const avgR = sorted.length ? sorted.reduce((s, e) => s + (e.revenus || 0), 0) / sorted.length : 0
  const changes = sorted.slice(1).map((e, i) => getTotal(e) - getTotal(sorted[i]))
  const avgE = changes.length ? changes.reduce((s, v) => s + v, 0) / changes.length : 0
  const tauxE = avgR > 0 ? avgE / avgR * 100 : 0

  const chartData = sorted.map(e => ({ name: getLabel(e.date), patrimoine: getTotal(e), revenus: e.revenus || 0 }))
  const pieData = latest ? Object.entries(latest.accounts || {}).filter(([, v]) => Number(v) > 0).map(([name, value]) => ({ name, value: Number(value) })) : []

  const userInitials = (user?.email || '??').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950 font-sans text-sm text-neutral-900 dark:text-neutral-100">

      {/* Sidebar */}
      <aside className="w-44 flex-shrink-0 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col p-3 gap-1">
        <div className="text-base font-medium px-2 pb-4 pt-1 tracking-tight">
          Patri<span className="text-violet-500">·</span>track
        </div>

        {(['dashboard', 'add', 'history', 'settings'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => navTo(v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
              view === v
                ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {v === 'dashboard' && '⊞'}
            {v === 'add' && '+'}
            {v === 'history' && '☰'}
            {v === 'settings' && '⚙'}
            <span className="capitalize">
              {v === 'dashboard' ? 'Dashboard' : v === 'add' ? 'Nouvelle saisie' : v === 'history' ? 'Historique' : 'Paramètres'}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 mt-2">
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-medium flex-shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{user?.email?.split('@')[0]}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 px-2 py-1 text-left transition-colors">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">

        {/* DASHBOARD */}
        {view === 'dashboard' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-base font-medium">Dashboard</h1>
                <p className="text-xs text-neutral-400 mt-0.5">Données de {user?.email?.split('@')[0]}</p>
              </div>
              <button onClick={() => navTo('add')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                + Nouvelle entrée
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Patrimoine total', value: fmt(cur), sub: varAbs >= 0 ? `+${fmt(varAbs)} (+${varPct.toFixed(1)}%)` : `${fmt(varAbs)} (${varPct.toFixed(1)}%)`, green: varAbs >= 0 },
                { label: 'Épargne mensuelle', value: fmt(avgE), sub: 'moyenne', green: avgE >= 0 },
                { label: 'Revenus moyens', value: fmt(avgR), sub: 'nets / mois', green: true },
                { label: "Taux d'épargne", value: `${tauxE.toFixed(1)}%`, sub: 'épargne / revenus', green: true },
              ].map((k, i) => (
                <div key={i} className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4">
                  <div className="text-xs text-neutral-400 mb-1.5">{k.label}</div>
                  <div className={`text-xl font-medium font-mono tracking-tight ${i === 0 ? '' : i === 1 ? (avgE >= 0 ? 'text-emerald-600' : 'text-red-500') : i === 3 ? 'text-violet-500' : ''}`}>
                    {k.value}
                  </div>
                  <div className={`text-xs mt-1 ${i === 0 ? (varAbs >= 0 ? 'text-emerald-500' : 'text-red-400') : 'text-neutral-400'}`}>
                    {k.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Graphique principal */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 mb-4">
              <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">Évolution du patrimoine</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k€`} />
                  <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="patrimoine" stroke="#7F77DD" strokeWidth={2} dot={{ r: 3, fill: '#7F77DD' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Revenus */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
                <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">Revenus mensuels</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k€`} />
                    <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="revenus" fill="#1D9E75" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Répartition */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
                <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">Répartition actuelle</div>
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1.5 flex-1">
                      {pieData.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-neutral-500 truncate max-w-24">{p.name}</span>
                          </div>
                          <span className="font-mono text-neutral-400">{cur > 0 ? Math.round(p.value / cur * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 text-center py-8">Aucune donnée</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NOUVELLE SAISIE */}
        {view === 'add' && (
          <div className="max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-base font-medium">{editId ? "Modifier l'entrée" : 'Nouvelle saisie'}</h1>
              <button onClick={() => setView('history')} className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">Annuler</button>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Mois / Année</label>
                  <input type="month" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Revenus nets (€)</label>
                  <input type="number" placeholder="3 500" value={form.revenus} onChange={e => setForm(f => ({ ...f, revenus: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>

              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 mb-5">
                <div className="text-xs font-medium text-neutral-400 mb-3">Soldes des comptes</div>
                <div className="flex flex-col gap-3">
                  {accounts.map((acc, i) => (
                    <div key={acc.id}>
                      <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COLORS[i % COLORS.length] }} />
                        {acc.name} (€)
                      </label>
                      <input type="number" placeholder="0" value={form.accounts[acc.name] || ''}
                        onChange={e => setForm(f => ({ ...f, accounts: { ...f.accounts, [acc.name]: e.target.value } }))}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSave}
                className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                {editId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* HISTORIQUE */}
        {view === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-base font-medium">Historique</h1>
              <button onClick={() => navTo('add')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                + Ajouter
              </button>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <th className="text-left p-3 font-medium text-neutral-400">Période</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Total</th>
                    {accounts.map(a => <th key={a.id} className="text-left p-3 font-medium text-neutral-400">{a.name}</th>)}
                    <th className="text-left p-3 font-medium text-neutral-400">Revenus</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Var.</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {[...sorted].reverse().map((e, i, arr) => {
                    const total = getTotal(e)
                    const origIdx = sorted.findIndex(x => x.id === e.id)
                    const prevEntry = origIdx > 0 ? sorted[origIdx - 1] : null
                    const diff = prevEntry ? total - getTotal(prevEntry) : null
                    return (
                      <tr key={e.id} className="border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="p-3 font-medium">{getLabel(e.date)}</td>
                        <td className="p-3 font-mono font-medium">{fmt(total)}</td>
                        {accounts.map(a => <td key={a.id} className="p-3 font-mono text-neutral-400">{fmt(Number(e.accounts?.[a.name] || 0))}</td>)}
                        <td className="p-3 font-mono text-neutral-400">{fmt(e.revenus || 0)}</td>
                        <td className="p-3">
                          {diff !== null ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${diff >= 0 ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400'}`}>
                              {diff >= 0 ? '+' : ''}{fmt(diff)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => navTo('add', e)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">Éditer</button>
                            <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 transition-colors">×</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {sorted.length === 0 && (
                    <tr><td colSpan={99} className="p-8 text-center text-neutral-400">Aucune entrée — commencez par ajouter un mois !</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PARAMÈTRES */}
        {view === 'settings' && (
          <div className="max-w-md">
            <h1 className="text-base font-medium mb-5">Paramètres</h1>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 mb-4">
              <div className="text-xs font-medium text-neutral-400 mb-3">Mon compte</div>
              <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center text-sm font-medium">
                  {userInitials}
                </div>
                <div>
                  <div className="text-sm font-medium">{user?.email?.split('@')[0]}</div>
                  <div className="text-xs text-neutral-400">{user?.email}</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
              <div className="text-xs font-medium text-neutral-400 mb-3">Comptes suivis</div>
              <div className="flex flex-col gap-2 mb-4">
                {accounts.map((acc, i) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {acc.name}
                    </div>
                    {accounts.length > 1 && (
                      <button onClick={() => handleDeleteAccount(acc.id, acc.name)} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Nom du nouveau compte…" value={newAccName}
                  onChange={e => setNewAccName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <button onClick={handleAddAccount}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm transition-colors">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50 ${
          toast.type === 's'
            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}