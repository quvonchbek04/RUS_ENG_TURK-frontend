import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { supabaseConfigError } from './lib/supabase.js'

// Agar .env sozlanmagan bo'lsa — oq ekran o'rniga aniq yo'riqnoma ko'rsatamiz.
function ConfigError({ message }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F7F4EE', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, background: '#fff', border: '1px solid #E3DDD1', borderRadius: 16, padding: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
        <h1 style={{ fontSize: 22, margin: '0 0 10px', color: '#1E1D1A' }}>Supabase sozlanmagan</h1>
        <p style={{ color: '#5B5750', lineHeight: 1.6, margin: '0 0 16px' }}>{message}</p>
        <ol style={{ color: '#5B5750', lineHeight: 1.8, paddingLeft: 20, margin: '0 0 16px' }}>
          <li><code>frontend/.env.example</code> faylidan nusxa olib <code>frontend/.env</code> yarating</li>
          <li>Supabase → Project Settings → API bo'limidan <b>Project URL</b> va <b>anon public</b> kalitni ko'chiring</li>
          <li><code>npm run dev</code> ni qayta ishga tushiring (.env o'zgarganda Vite qayta ishga tushirilishi shart)</li>
        </ol>
        <pre style={{ background: '#F2EEE6', padding: 14, borderRadius: 10, fontSize: 12, overflowX: 'auto', margin: 0 }}>
{`VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {supabaseConfigError ? <ConfigError message={supabaseConfigError} /> : <App />}
  </StrictMode>,
)
