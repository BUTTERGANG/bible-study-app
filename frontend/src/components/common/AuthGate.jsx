import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '../../api/client'
import { getAppPassword, getAccessToken, setAppPassword, setTokens } from '../../api/auth'

// Wraps the app. Shows auth UI when required and no valid credential exists.
// Supports three modes:
//   - Legacy (APP_PASSWORD set): shows password prompt
//   - User accounts: shows login/register tabs
//   - Open: passes through immediately

export default function AuthGate({ children }) {
  const [tick, setTick] = useState(0)
  const [mode, setMode] = useState('login')   // 'login' | 'register'
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['auth-status', tick],
    queryFn: api.getAuthStatus,
    staleTime: Infinity,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-400 text-sm">
        Connecting…
      </div>
    )
  }

  const { required, user_accounts_enabled, legacy_auth } = data ?? {}
  const haveCredential = !!getAccessToken() || !!getAppPassword()

  if (!required || haveCredential) return children

  // --- Legacy APP_PASSWORD mode ---
  if (legacy_auth && !user_accounts_enabled) {
    async function submitPassword(e) {
      e.preventDefault()
      const value = e.target.password.value.trim()
      if (!value) return
      setAppPassword(value)
      try {
        await api.getBookmarks()
        setTick((t) => t + 1)
        setError(null)
      } catch (err) {
        setAppPassword(null)
        setError(err.message || 'Invalid password')
      }
    }

    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
        <form onSubmit={submitPassword} className={cardCls}>
          <Header title="App password required" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            This instance is protected. Enter the shared password to continue.
          </p>
          <input name="password" type="password" autoFocus className={inputCls} placeholder="Password" />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <button type="submit" className={btnCls}>Continue</button>
        </form>
      </div>
    )
  }

  // --- User accounts mode ---
  async function submitAccount(e) {
    e.preventDefault()
    const email = e.target.email.value.trim()
    const password = e.target.password.value
    if (!email || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = mode === 'register'
        ? await api.register(email, password)
        : await api.login(email, password)
      setTokens(res)
      setTick((t) => t + 1)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <form onSubmit={submitAccount} className={cardCls}>
        <Header title="Bible Study" />

        {/* Tab switcher */}
        <div className="flex mb-4 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <input name="email" type="email" autoFocus required className={inputCls} placeholder="Email" />
        <input name="password" type="password" required className={`${inputCls} mt-2`} placeholder="Password" />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <button type="submit" disabled={loading} className={`${btnCls} mt-3 disabled:opacity-60`}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

const cardCls =
  'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 w-full max-w-sm'

const inputCls =
  'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100'

const btnCls =
  'w-full bg-blue-600 hover:bg-blue-700 text-white text-sm rounded py-2'

function Header({ title }) {
  return (
    <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-100">
      <Lock size={18} />
      <h1 className="text-base font-semibold">{title}</h1>
    </div>
  )
}
