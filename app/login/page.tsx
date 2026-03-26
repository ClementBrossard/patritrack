'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmail, signUpWithEmail, signInWithGoogle, createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
        router.push(redirectTo)
        router.refresh()
      } else {
        if (!displayName.trim()) throw new Error('Prénom requis')
        await signUpWithEmail(email, password, displayName)
        setSuccess('Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.')
        setMode('login')
      }
    } catch (err: any) {
      const msg = err?.message || 'Une erreur est survenue'
      if (msg.includes('Invalid login')) setError('Email ou mot de passe incorrect.')
      else if (msg.includes('already registered')) setError('Cet email est déjà utilisé.')
      else if (msg.includes('Password')) setError('Mot de passe trop court (6 caractères min).')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try { await signInWithGoogle() }
    catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleForgotPassword() {
    if (!email) { setError("Entre ton email d'abord"); return }
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`
      })
      setSuccess('Email de réinitialisation envoyé !')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium tracking-tight">
            Patri<span className="text-violet-500">·</span>track
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-7 shadow-sm">

          {/* Erreur / Succès */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Alexandra"
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="toi@email.com"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                required={mode === 'signup'}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          {/* Mot de passe oublié */}
          {mode === 'login' && (
            <div className="mt-3 text-center">
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:underline transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            <span className="text-xs text-neutral-400">ou</span>
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-sm transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>

          <p className="text-center text-xs text-neutral-400 mt-5">
            {mode === 'login' ? (
              <>Pas de compte ?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setSuccess('') }} className="text-violet-500 hover:underline">
                  Créer un compte
                </button>
              </>
            ) : (
              <>Déjà inscrit ?{' '}
                <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} className="text-violet-500 hover:underline">
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-4">
          Chaque compte est isolé — tes données restent privées.
        </p>
      </div>
    </div>
  )
}