import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, LANG_BY_KEY, Modal, StatCard, formatDate, formatDateTime } from '../../components/ui.jsx';
import { resultPct } from '../../components/PracticeResult.jsx';
import { api } from '../../lib/api.js';
import { countCompletedMonths, getStreak } from '../../lib/lessonProgress.js';
import { formatPhone } from '../../lib/identity.js';

export const ROLE_LABEL = { superadmin: 'Super admin', admin: 'Admin', user: "O'quvchi" };
const ROLE_BADGE = { superadmin: 'badge-gold', admin: 'badge-pine', user: '' };

const SORTS = [
  ['new', 'Yangi qo\'shilganlar'],
  ['old', 'Eski'],
  ['name', 'Ism (A–Z)'],
  ['login', 'Oxirgi kirish'],
];

function Avatar({ u, size = 40 }) {
  const staff = u.role !== 'user';
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: staff ? 'var(--grad-brand)' : 'var(--paper-soft)', color: staff ? '#fff' : 'var(--ink)' }}
    >
      {(u.displayName || u.username || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

function Contacts({ u }) {
  return (
    <div className="text-xs muted space-y-0.5 min-w-0">
      {u.email && <div className="truncate">📧 {u.email}</div>}
      {u.phone && <div className="truncate">📱 {formatPhone(u.phone)}</div>}
      {!u.email && !u.phone && <div className="truncate">🔑 {u.username}</div>}
    </div>
  );
}

/** Bitta foydalanuvchi kartasi (progress bilan). */
function UserDetail({ id, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.userDetail(id).then(setD).catch((e) => setError(e.message));
  }, [id]);
  const p = d?.progress || {};
  const history = p.practiceHistory || [];
  return (
    <Modal open onClose={onClose} title={d ? d.user.displayName || d.user.username : 'Foydalanuvchi'}>
      {error && <div className="alert alert-error">{error}</div>}
      {!d && !error && <div className="skeleton h-40" />}
      {d && (
        <div>
          <div className="card-soft p-3.5 mb-4 text-sm space-y-1" style={{ color: 'var(--ink)' }}>
            <div>🔑 Login: <b className="font-mono">{d.user.username}</b></div>
            {d.user.email && <div>📧 {d.user.email}</div>}
            {d.user.phone && <div>📱 {formatPhone(d.user.phone)}</div>}
            <div>
              👤 {ROLE_LABEL[d.user.role]} · ro'yxatdan o'tgan: {formatDate(d.user.createdAt)}
              {d.user.isBlocked && <span className="badge badge-brick ml-2">Bloklangan</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <StatCard icon="⭐" label="XP" value={p.xpTotal || 0} tone="gold" />
            <StatCard icon="🔥" label="Seriya" value={getStreak(p)} tone="brick" />
            <StatCard icon="✅" label="Darslar" value={countCompletedMonths(p)} />
            <StatCard icon="🤖" label="Bugun AI" value={d.aiUsedToday} tone="sky" />
          </div>
          <div className="text-sm mb-2" style={{ color: 'var(--ink)' }}>
            Tillar bo'yicha: {['en', 'ru', 'tr'].map((l) => `${LANG_BY_KEY[l].flag} ${countCompletedMonths(p, l)} dars`).join(' · ')}
          </div>
          <div className="label mt-4">Oxirgi mashqlar</div>
          {history.length === 0 ? (
            <div className="text-sm muted">Mashq bajarilmagan.</div>
          ) : (
            <div className="space-y-1.5">
              {history.slice(0, 8).map((r) => (
                <div key={r.id} className="card-soft px-3 py-2 flex items-center gap-2 text-sm">
                  <span>{LANG_BY_KEY[r.lang]?.flag}</span>
                  <span className="flex-1 truncate" style={{ color: 'var(--ink)' }}>
                    {r.label}
                  </span>
                  <span className="text-xs muted">{formatDateTime(r.at)}</span>
                  <span className={`badge ${resultPct(r) >= 60 ? 'badge-pine' : 'badge-brick'}`}>{resultPct(r)}%</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs faint mt-4">Progress yangilangan: {formatDateTime(d.progressUpdatedAt)}</div>
        </div>
      )}
    </Modal>
  );
}

/** Admin panel → "Foydalanuvchilar" oynasi: ro'yxat, qidiruv, saralash, qo'shish va boshqarish. */
export default function UsersPanel({ me, openForm = false }) {
  const isSuper = me.role === 'superadmin';
  const [users, setUsers] = useState(null);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sort, setSort] = useState('new');
  const [form, setForm] = useState({ identifier: '', phone: '+998 ', password: '', displayName: '', role: 'user' });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(openForm);
  const [detailId, setDetailId] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listAdminUsers()
      .then((r) => {
        setUsers(r.users);
        setLimited(!!r.limited);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(refresh, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (users || []).filter(
      (u) =>
        (roleFilter === 'all' ||
          (roleFilter === 'staff' ? u.role !== 'user' : roleFilter === 'blocked' ? u.isBlocked : u.role === roleFilter)) &&
        (!q || [u.displayName, u.username, u.email, u.phone].some((x) => String(x || '').toLowerCase().includes(q)))
    );
    const t = (d) => (d ? new Date(d).getTime() : 0);
    const sorters = {
      new: (a, b) => t(b.createdAt) - t(a.createdAt),
      old: (a, b) => t(a.createdAt) - t(b.createdAt),
      name: (a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username), 'uz'),
      login: (a, b) => t(b.lastSignInAt || b.lastSeenAt) - t(a.lastSignInAt || a.lastSeenAt),
    };
    return [...list].sort(sorters[sort]);
  }, [users, query, roleFilter, sort]);

  const canManage = (u) => !limited && u.id !== me.id && u.role !== 'superadmin' && (isSuper || u.role === 'user');

  async function act(fn, okText) {
    setError('');
    setNotice('');
    try {
      await fn();
      if (okText) setNotice(okText);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const { user } = await api.createUser(form);
      setUsers((prev) => [...(prev || []), user]);
      const ways = [user.email || (form.identifier.includes('@') ? form.identifier : null), user.phone ? formatPhone(user.phone) : null, user.username]
        .filter(Boolean)
        .join(' yoki ');
      setNotice(`✅ "${user.displayName || user.username}" qo'shildi (${ROLE_LABEL[user.role]}). Kirish: ${ways} + parol`);
      setForm({ identifier: '', phone: '+998 ', password: '', displayName: '', role: 'user' });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const all = users || [];
  const today = new Date().toISOString().slice(0, 10);
  const counts = {
    all: all.length,
    user: all.filter((u) => u.role === 'user').length,
    staff: all.filter((u) => u.role !== 'user').length,
    blocked: all.filter((u) => u.isBlocked).length,
    today: all.filter((u) => String(u.lastSeenAt || u.lastSignInAt || '').slice(0, 10) === today).length,
  };

  function Actions({ u }) {
    if (!canManage(u)) return <span className="text-xs faint">—</span>;
    return (
      <div className="flex flex-nowrap gap-1.5 justify-end">
        {isSuper && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title={u.role === 'admin' ? "Oddiy o'quvchiga aylantirish" : 'Admin qilish'}
            onClick={() => {
              const role = u.role === 'admin' ? 'user' : 'admin';
              if (confirm(`"${u.displayName || u.username}" ${role === 'admin' ? 'ADMIN qilinsinmi' : "oddiy o'quvchiga aylantirilsinmi"}?`)) {
                act(() => api.setRole(u.id, role), "Rol o'zgartirildi");
              }
            }}
          >
            {u.role === 'admin' ? '⬇' : '⬆'} <span className="hidden xl:inline">{u.role === 'admin' ? "O'quvchi" : 'Admin'}</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Parolni tiklash"
          onClick={() => {
            const pw = prompt(`"${u.displayName || u.username}" uchun yangi parol (kamida 6 belgi):`);
            if (pw) act(() => api.resetUserPassword(u.id, pw), `Parol yangilandi: ${pw}`);
          }}
        >
          🔑
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title={u.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
          onClick={() => act(() => api.blockUser(u.id, !u.isBlocked), u.isBlocked ? 'Blok olib tashlandi' : 'Foydalanuvchi bloklandi')}
        >
          {u.isBlocked ? '🔓' : '⛔'}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          title="O'chirish"
          onClick={() => {
            if (confirm(`"${u.displayName || u.username}" butunlay o'chirilsinmi? Uning barcha progressi ham o'chadi.`)) {
              act(() => api.deleteUser(u.id), "Foydalanuvchi o'chirildi");
            }
          }}
        >
          🗑
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <div className="h2">👥 Foydalanuvchilar ro'yxati</div>
          <div className="text-sm muted">
            Jami {counts.all} · o'quvchilar {counts.user} · adminlar {counts.staff} · bugun faol {counts.today}
            {counts.blocked ? ` · bloklangan ${counts.blocked}` : ''}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={refresh} disabled={loading} title="Yangilash">
          {loading ? <span className="spinner" /> : '↻'} Yangilash
        </button>
        <button type="button" className="btn btn-gold" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Yopish' : isSuper ? '+ Foydalanuvchi / admin' : '+ Foydalanuvchi'}
        </button>
      </div>

      {limited && (
        <div className="alert alert-warn mb-4 text-sm">
          ⚠️ "admin" Edge Function'ga ulanib bo'lmadi — faqat ro'yxat ko'rsatilmoqda. Qo'shish/o'chirish uchun funksiyani joylang (DEPLOY.md).
        </div>
      )}

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 sm:p-5 mb-5 anim-rise">
          <div className="font-bold mb-1" style={{ color: 'var(--ink)' }}>
            Yangi {form.role === 'admin' ? 'admin' : "o'quvchi"} qo'shish
          </div>
          <p className="text-xs muted mb-3">Login yoki email + ixtiyoriy telefon. Ikkalasi kiritilsa, foydalanuvchi istalgani bilan kira oladi.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="field">
              <span className="label">Login yoki email</span>
              <input className="input" value={form.identifier} onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))} placeholder="ali123 yoki ali@mail.uz" required />
            </label>
            <label className="field !mt-0">
              <span className="label">Telefon (ixtiyoriy)</span>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+998 90 123 45 67" />
            </label>
            <label className="field !mt-0">
              <span className="label">Parol (min 6)</span>
              <input className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} minLength={6} required autoComplete="new-password" />
            </label>
            <label className="field !mt-0">
              <span className="label">Ism</span>
              <input className="input" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Ixtiyoriy" />
            </label>
            <label className="field !mt-0">
              <span className="label">Rol</span>
              <select className="select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="user">O'quvchi</option>
                {isSuper && <option value="admin">Admin</option>}
              </select>
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={creating}>
            {creating ? <><span className="spinner" /> Qo'shilmoqda…</> : "+ Qo'shish"}
          </button>
        </form>
      )}

      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
        <input className="input flex-1 min-w-[200px]" placeholder="🔍 Ism, login, email yoki telefon…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="select !w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash">
          {SORTS.map(([k, l]) => (
            <option key={k} value={k}>
              ↕ {l}
            </option>
          ))}
        </select>
        <div className="tabs w-full">
          {[
            ['all', 'Barchasi'],
            ['user', "O'quvchilar"],
            ['staff', 'Adminlar'],
            ['blocked', 'Bloklanganlar'],
          ].map(([k, l]) => (
            <button key={k} type="button" className={`chip ${roleFilter === k ? 'chip-active' : ''}`} onClick={() => setRoleFilter(k)}>
              {l} · {counts[k]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {notice && <div className="alert alert-success mb-4">{notice}</div>}
      {!users && !error && <div className="skeleton h-40" />}
      {users && filtered.length === 0 && <EmptyState icon="👥" title="Foydalanuvchi topilmadi" text="Qidiruv yoki filtrni o'zgartirib ko'ring." />}

      {/* Kompyuter: jadval */}
      {filtered.length > 0 && (
        <div className="card overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider muted" style={{ background: 'var(--panel-2)' }}>
                <th className="py-3 px-4 font-bold">Foydalanuvchi</th>
                <th className="py-3 px-3 font-bold">Kirish (email / telefon)</th>
                <th className="py-3 px-3 font-bold">Rol</th>
                <th className="py-3 px-3 font-bold">Ro'yxatdan o'tgan</th>
                <th className="py-3 px-3 font-bold">Oxirgi kirish</th>
                <th className="py-3 px-4 font-bold text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--line)', opacity: u.isBlocked ? 0.65 : 1 }}>
                  <td className="py-2.5 px-4">
                    <button type="button" className="flex items-center gap-3 text-left" onClick={() => setDetailId(u.id)} title="Batafsil">
                      <Avatar u={u} size={36} />
                      <span className="min-w-0">
                        <span className="block font-bold truncate max-w-[220px]" style={{ color: 'var(--ink)' }}>
                          {u.displayName || u.username}
                          {u.id === me.id && <span className="text-xs muted font-normal"> (siz)</span>}
                        </span>
                        <span className="block text-xs faint font-mono">@{u.username}</span>
                      </span>
                    </button>
                  </td>
                  <td className="py-2.5 px-3 max-w-[260px]">
                    <Contacts u={u} />
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role] || u.role}</span>
                    {u.isBlocked && <span className="badge badge-brick ml-1">Bloklangan</span>}
                  </td>
                  <td className="py-2.5 px-3 muted whitespace-nowrap">{formatDate(u.createdAt)}</td>
                  <td className="py-2.5 px-3 muted whitespace-nowrap">{u.lastSignInAt || u.lastSeenAt ? formatDateTime(u.lastSignInAt || u.lastSeenAt) : '—'}</td>
                  <td className="py-2.5 px-4">
                    <Actions u={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Telefon: kartochkalar */}
      <div className="space-y-2 md:hidden">
        {filtered.map((u) => (
          <div key={u.id} className="card p-3.5" style={{ opacity: u.isBlocked ? 0.7 : 1 }}>
            <button type="button" className="w-full flex items-center gap-3 text-left" onClick={() => setDetailId(u.id)}>
              <Avatar u={u} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {u.displayName || u.username}
                  {u.id === me.id && <span className="text-xs muted font-normal"> (siz)</span>}
                </div>
                <Contacts u={u} />
              </div>
              <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
            </button>
            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--line)' }}>
              <span className="text-[11px] faint flex-1">
                {formatDate(u.createdAt)}
                {u.isBlocked && <span className="badge badge-brick ml-1">Bloklangan</span>}
              </span>
              <Actions u={u} />
            </div>
          </div>
        ))}
      </div>

      {detailId && <UserDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
