import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '../../api/client'
import { getAppPassword, setAppPassword } from '../../api/auth'

// Wraps the app. If the backend reports auth is required and we don't have a
// stored password (or it's wrong), render a small login form. Otherwise pass
// through to children.

export default function AuthGate({ children }) {
  const [tick, setTick] = useState(0)
  const [error, setError] = useState(null)

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

  const required = data?.required
  const haveSecret = !!getAppPassword()
  if (!required || haveSecret) return children

  async function submit(e) {
    e.preventDefault()
    const value = e.target.password.value.trim()
    if (!value) return
    setAppPassword(value)
    // Validate by hitting an authenticated endpoint.
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
      <form
        onSubmit={submit}
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-100">
          <Lock size={18} />
          <h1 className="text-base font-semibold">App password required</h1>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          This instance is protected. Enter the shared password to continue.
        </p>
        <input
          name="password"
          type="password"
          autoFocus
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
          placeholder="Password"
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <button
          type="submit"
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm rounded py-2"
        >
          Continue
        </button>
      </form>
    </div>
  )
}
