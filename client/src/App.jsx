import { AuthProvider, useAuth } from './AuthContext'
import AuthPage from './pages/AuthPage'
import App_Main from './App_Main'

function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  )

  if (!user) return <AuthPage />
  return <App_Main />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}