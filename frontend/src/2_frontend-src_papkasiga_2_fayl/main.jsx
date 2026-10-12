import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { primeVoices, unlockSpeech } from './lib/tts.js'
import { captureInstallPrompt } from './lib/install.js'

// Telefon uchun: ovozlar ro'yxatini oldindan yuklash, iPhone'da ovozni birinchi bosishda "ochish"
primeVoices()
;['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockSpeech, { once: true, passive: true, capture: true }))

// "Ilovani yuklab olish" uchun brauzerning o'rnatish so'rovini ushlab qolish (hodisa React'dan oldin kelishi mumkin)
captureInstallPrompt()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker (faqat tayyor saytda): ilova o'rnatilganda tez ochilishi va internet uzilganda ham darslar ko'rinishi uchun
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
