import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

/** Ikki holat: (1) email kiritib tiklash xatini so'rash; (2) xatdagi havola orqali kelganda yangi parol o'rnatish. */
export default function ResetPassword() {
  const { recovery, clearRecovery, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const settingNew = recovery || (user && window.location.hash.includes('type=recovery'));

  async function requestReset(e) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await api.requestPasswordReset(email);
      setMsg({ ok: true, text: "📧 Parolni tiklash havolasi emailingizga yuborildi. Pochtangizni (va Spam papkasini) tekshiring." });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function setNewPassword(e) {
    e.preventDefault();
    if (password !== password2) {
      setMsg({ ok: false, text: 'Parollar bir xil emas' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await api.updatePassword(password);
      clearRecovery();
      navigate('/', { replace: true });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  }

  if (settingNew) {
    return (
      <AuthShell eyebrow="Xavfsizlik" title="Yangi parol o'rnating">
        <form onSubmit={setNewPassword} className="space-y-4">
          <label className="field">
            <span className="label">Yangi parol</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
          </label>
          <label className="field">
            <span className="label">Takrorlang</span>
            <input type="password" className="input" value={password2} onChange={(e) => setPassword2(e.target.value)} minLength={6} required />
          </label>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <button type="submit" className="btn btn-brand btn-lg btn-block" disabled={loading}>
            {loading ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Parolni tiklash"
      title="Parolni unutdingizmi?"
      footer={
        <Link to="/login" className="font-bold" style={{ color: 'var(--pine)' }}>
          ← Kirish sahifasiga qaytish
        </Link>
      }
    >
      <form onSubmit={requestReset} className="space-y-4">
        <label className="field">
          <span className="label">Ro'yxatdan o'tgan email manzilingiz</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ism@gmail.com" />
        </label>
        <div className="alert alert-info text-sm">
          📱 Telefon raqami orqali ro'yxatdan o'tgan bo'lsangiz, parolni administrator tiklab beradi.
        </div>
        {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading ? 'Yuborilmoqda…' : 'Tiklash havolasini yuborish'}
        </button>
      </form>
    </AuthShell>
  );
}
