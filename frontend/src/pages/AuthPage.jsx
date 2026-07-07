import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogIn, UserPlus } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email || !password) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await signUp(email, password)
        setSuccess('Account created! Check your email to verify, then log in.')
        setMode('login')
        setPassword('')
      } else {
        await signIn(email, password)
        // Auth context will auto-redirect via App.jsx
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Ambient blobs */}
      <div className="blob w-96 h-96 bg-royal" style={{ top: '-80px', left: '-80px' }} />
      <div className="blob w-80 h-80 bg-blush" style={{ bottom: '-60px', right: '-60px' }} />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="glass rounded-4xl p-8 md:p-10 shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#4169E1' }}>
              💸 Kharcha Tracker
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-blue-100 bg-white/60 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-blue-100 bg-white/60 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {success && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-60"
              style={{ background: '#4169E1' }}
            >
              {mode === 'login' ? (
                <>
                  <LogIn size={16} />
                  {loading ? 'Signing in...' : 'Sign In'}
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  {loading ? 'Creating account...' : 'Sign Up'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
                setSuccess('')
              }}
              className="text-xs text-gray-500 hover:text-royal transition underline"
            >
              {mode === 'login'
                ? 'Need an account? Sign up'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
