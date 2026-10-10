import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import { DialogView } from '../components/LessonExtras.jsx';
import { PageHeader, PageLoading } from '../components/ui.jsx';
import { useContent } from '../lib/hooks.js';
import { t } from '../i18n/index.js';

export default function DialogsPage() {
  const { lang } = useParams();
  const { data, error } = useContent(lang);
  const [openKey, setOpenKey] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  // `sub` o'zbekcha saqlanadi; chiqarishda t() bilan o'giriladi
  const all = useMemo(() => {
    if (!data) return [];
    const list = [];
    data.modules.forEach((mod) =>
      mod.months.forEach((month) => {
        if (month.dialog) list.push({ key: `m-${month.id}`, group: 'course', title: month.dialog.title, sub: `${month.label} · ${month.topic}`, lines: month.dialog.lines });
        if (month.dialog2) list.push({ key: `m2-${month.id}`, group: 'course', title: month.dialog2.title, sub: `${month.label} · 2-dialog`, lines: month.dialog2.lines });
      })
    );
    (data.dialogsExtra || []).forEach((d, i) => list.push({ key: `x-${i}`, group: 'extra', title: d.title, sub: [d.subtitle, d.level].filter(Boolean).join(' · '), lines: d.lines }));
    (data.uploadedDialogs || []).forEach((d) =>
      list.push({ key: `u-${d.id}`, group: 'uploaded', title: d.title, sub: d.description || 'Yuklangan dialog', lines: d.content?.lines || [], audioUrl: d.fileUrl })
    );
    return list;
  }, [data]);

  const filtered = all.filter(
    (d) => (filter === 'all' || d.group === filter) && (!query.trim() || `${d.title} ${d.sub} ${d.lines.map((l) => l[1]).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  );

  if (error) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">{error}</div>
        </div>
      </Layout>
    );
  }
  if (!data)
    return (
      <Layout>
        <PageLoading />
      </Layout>
    );

  const counts = { all: all.length, course: all.filter((d) => d.group === 'course').length, extra: all.filter((d) => d.group === 'extra').length, uploaded: all.filter((d) => d.group === 'uploaded').length };

  return (
    <Layout>
      <div className="page-narrow">
        <PageHeader
          back={{ to: `/lang/${lang}`, label: t(data.meta.title) }}
          eyebrow={`${data.meta.flag} ${t('Dialog mashqi')}`}
          title={t('Barcha dialoglar · {n}', { n: all.length })}
          subtitle={t('Dialogni ovoz bilan tinglang, har bir gapni takrorlang va AI ustoz beradigan vazifani bajaring.')}
        />
        <div className="tabs mb-3">
          {[
            ['all', 'Barchasi'],
            ['course', 'Darslardan'],
            ['extra', "Qo'shimcha"],
            ['uploaded', 'Yuklanganlar'],
          ].map(([k, l]) =>
            counts[k] || k === 'all' ? (
              <button key={k} type="button" className={`chip ${filter === k ? 'chip-active' : ''}`} onClick={() => setFilter(k)}>
                {t(l)} · {counts[k]}
              </button>
            ) : null
          )}
        </div>
        <input className="input mb-4" placeholder={t('🔍 Dialog qidirish…')} value={query} onChange={(e) => setQuery(e.target.value)} />

        <div className="space-y-3">
          {filtered.map((d, i) => {
            const isOpen = openKey === d.key;
            return (
              <div key={d.key} className="card overflow-hidden">
                <button type="button" onClick={() => setOpenKey(isOpen ? null : d.key)} className="w-full text-left p-4 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'var(--pine-soft)', color: 'var(--pine)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold truncate" style={{ color: 'var(--ink)' }}>
                      {d.title}
                    </div>
                    <div className="text-xs muted truncate">
                      {t(d.sub)} · {t('{n} qator', { n: d.lines.length })}
                    </div>
                  </div>
                  <span className="muted text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                    <DialogView lines={d.lines} lang={lang} audioUrl={d.audioUrl} />
                    <AiTaskWidget type="dialog" content={d.lines.map(([s, l, tr]) => `${s}: ${l}${tr ? ` (${tr})` : ''}`).join('\n')} lang={lang} title="Dialog bo'yicha AI vazifa" />
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center muted py-12">{t('Dialog topilmadi.')}</div>}
        </div>
      </div>
    </Layout>
  );
}
