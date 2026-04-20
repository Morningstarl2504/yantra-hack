import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)
export const AUTH_API = 'http://localhost:5173/api'

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(() => localStorage.getItem('edtech_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      axios.get(`${AUTH_API}/auth/me`)
        .then(r => setUser(r.data))
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const r = await axios.post(`${AUTH_API}/auth/login`, { email, password })
    localStorage.setItem('edtech_token', r.data.token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`
    setToken(r.data.token); setUser(r.data.user)
    return r.data.user
  }

  const register = async (data) => {
    const r = await axios.post(`${AUTH_API}/auth/register`, data)
    localStorage.setItem('edtech_token', r.data.token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`
    setToken(r.data.token); setUser(r.data.user)
    return r.data.user
  }

  const logout = () => {
    localStorage.removeItem('edtech_token')
    delete axios.defaults.headers.common['Authorization']
    setToken(null); setUser(null)
  }

  const saveQuizResults = async (results) => {
    try {
      for (const r of results) {
        await axios.patch(`${AUTH_API}/auth/quiz-result`, r)
      }
      const res = await axios.get(`${AUTH_API}/auth/me`)
      setUser(res.data)
    } catch(e) { console.error('Save quiz failed:', e) }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, saveQuizResults }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)