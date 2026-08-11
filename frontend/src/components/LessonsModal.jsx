import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isMonthDone, isMonthUnlocked, isAdminRole } from '../lib/lessonProgress.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LessonsModal({ open, onClose, modules, lang, flat, progress, initialModuleId = null }) {
  const [selectedModuleId, setSelectedModuleId] = useState(initialModuleId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);

  useEffect(() => {
    if (open) setSelectedModuleId(initialModuleId);
  }, [open, initialModuleId]);

  if (!open) return null;

  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  function close() {
    setSelectedModuleId(null);
    onClose();
  }

  function goToMonth(mod, month) {
    navigate(`/lang/${lang}/month/${mod.id}/${month.id}`);
    close();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,20,19,0.55)' }}
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-2xl border max-h-[80vh] scroll-panel"
        style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 flex items-center justify-between gap-4 px-5 py-4 border-b"
          style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
        >
          <div>
            {selectedModule ? (
              <button
                onClick={() => setSelectedModuleId(null)}
                className="font-mono text-[10px] uppercase tracking-widest cursor-pointer mb-1"
                style={{ color: 'var(--ink-soft)' }}
              >
                ← Bosqichlar
              </button>
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
                Darslar
              </div>
            )}
            <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              {selectedModule ? selectedModule.title : '4 ta bosqichni tanlang'}
            </h2>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
            style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {!selectedModule &&
            modules.map((mod, idx) => {
              const doneInMod = mod.months.filter((m) => isMonthDone(progress, lang, m.id)).length;
              return (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModuleId(mod.id)}
                  className="w-full text-left rounded-xl border p-4 flex items-center gap-4 mb-3 cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center font-mono text-sm font-semibold shrink-0"
                    style={{ background: 'var(--paper-soft)', color: 'var(--ink)' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {mod.title}
                    </div>
                    <div className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {mod.sub} · {doneInMod}/{mod.months.length} dars
                    </div>
                  </div>
                  <span className="font-mono text-sm" style={{ color: 'var(--gold)' }}>
                    →
                  </span>
                </button>
              );
            })}

          {selectedModule &&
            selectedModule.months.map((month) => {
              const flatIdx = flat.findIndex((m) => m.id === month.id);
              const done = isMonthDone(progress, lang, month.id);
              const unlocked = isMonthUnlocked(progress, lang, flat, flatIdx, isAdmin);
              return (
                <button
                  key={month.id}
                  disabled={!unlocked}
                  onClick={() => unlocked && goToMonth(selectedModule, month)}
                  className="w-full text-left rounded-xl border p-4 flex items-center justify-between gap-4 mb-3"
                  style={{
                    borderColor: 'var(--line)',
                    background: 'var(--panel)',
                    opacity: unlocked ? 1 : 0.5,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--ink-soft)' }}>
                      {month.label}
                    </div>
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {month.topic}
                    </div>
                  </div>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs shrink-0"
                    style={{
                      background: done ? 'var(--pine)' : 'var(--paper-soft)',
                      color: done ? 'var(--paper)' : 'var(--ink-soft)',
                    }}
                  >
                    {done ? '✓' : unlocked ? '○' : '🔒'}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
