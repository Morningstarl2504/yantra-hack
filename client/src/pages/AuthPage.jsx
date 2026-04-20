import { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode,    setMode]    = useState('login')
  const [role,    setRole]    = useState('student')
  const [form,    setForm]    = useState({ name:'', email:'', password:'', subject:'', institution:'' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        if (!form.name.trim()) { setError('Name is required'); setLoading(false); return }
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
        await register({ ...form, role })
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong. Check that your server is running on port 5173.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b-4 border-orange-600 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm">AI</div>
        <h1 className="text-xl font-bold text-orange-600">AI Ed-Tech Platform</h1>
        <div className="ml-auto text-xs text-gray-400">Team 22BCE0549 & 22BCT0102</div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md p-8">

          {/* Role selector */}
          <div className="flex gap-2 mb-6">
            {['student','teacher'].map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm capitalize transition
                  ${role===r ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-orange-50'}`}>
                {r === 'student' ? '🎓 Student' : '👨‍🏫 Teacher'}
              </button>
            ))}
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-1">
            {mode === 'login' ? 'Welcome back' : `Create ${role} account`}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {mode === 'login' ? 'Sign in to continue' : 'Join the platform today'}
          </p>

          <div className="space-y-3">
            {mode === 'register' && (
              <input placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            )}
            <input placeholder="Email address" type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            <input placeholder="Password (min 6 chars)" type="password" value={form.password} onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            {mode === 'register' && role === 'teacher' && (
              <>
                <input placeholder="Subject (e.g. Mathematics)" value={form.subject} onChange={e => set('subject', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                <input placeholder="Institution (optional)" value={form.institution} onChange={e => set('institution', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </>
            )}
          </div>

          {error && <p className="text-red-600 text-xs mt-3 bg-red-50 p-2.5 rounded-lg">{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full mt-5 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg text-sm transition disabled:opacity-50">
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(mode==='login'?'register':'login'); setError('') }}
              className="text-orange-600 font-semibold hover:underline">
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}