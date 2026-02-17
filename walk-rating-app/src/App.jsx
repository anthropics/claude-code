import Home from './pages/Home'
import { isSupabaseConfigured } from './lib/supabase'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>NS Walk Ratings</h1>
        <p className="subtitle">Rate your walks around Nova Scotia</p>
      </header>
      <main>
        <Home />
      </main>
      {!isSupabaseConfigured() && (
        <div className="local-storage-banner">
          Using local storage. Add Supabase credentials in <code>.env</code> to sync across devices.
        </div>
      )}
    </div>
  )
}
