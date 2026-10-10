import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PracticeSession from '../components/PracticeSession.jsx';
import PracticeResult from '../components/PracticeResult.jsx';
import { PageLoading } from '../components/ui.jsx';
import { useContent } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import { flattenMonths, isMonthDone, QUIZ_PASS_THRESHOLD, withActivity, withPracticeSession } from '../lib/lessonProgress.js';
import { shuffle } from '../lib/practice.js';
import { t } from '../i18n/index.js';

/** Dars testi: dars so'zlari + Word fayldagi so'zlardan aralash savollar. To'xtatilsa ham
 *  javob berilmagan savollar xato hisoblanadi (umumiy son o'zgarmaydi). */
export default function VocabPractice() {
  const { lang, moduleId, monthId } = useParams();
  const { updateProgress, progress } = useAuth();
  const { data, error } = useContent(lang);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [retryItems, setRetryItems] = useState(null);

  const month = useMemo(() => data?.modules.find((m) => m.id === moduleId)?.months.find((mo) => mo.id === monthId), [data, moduleId, monthId]);

  const { items, pool } = useMemo(() => {
    if (!month) return { items: [], pool: [] };
    const base = (month.vocab || []).map(([w, tr, m]) => ({ w, t: tr !== w ? tr : '', m }));
    const extra = shuffle(month.words || []).slice(0, 14).map(([w, m, s, st]) => ({ w, m, s, st }));
    const poolItems = [...base, ...(month.words || []).map(([w, m]) => ({ w, m }))];
    return { items: [...base, ...extra], pool: poolItems };
  }, [month]);

  const onFinish = useCallback(
    (record) => {
      setResult(record);
      if (retryItems) {
        updateProgress((prev) => withActivity(withPracticeSession(prev, record), record.correct, { answers: record.answered }));
        return;
      }
      updateProgress((prev) => {
        const wasDone = isMonthDone(prev, lang, monthId);
        const testResults = { ...(prev.testResults || {}) };
        const langResults = { ...(testResults[lang] || {}) };
        const old = langResults[monthId];
        const pct = record.total ? record.correct / record.total : 0;
        const oldPct = old?.total ? old.correct / old.total : -1;
        // Eng yaxshi natija saqlanadi
        langResults[monthId] = pct >= oldPct ? { correct: record.correct, total: record.total, at: record.at } : old;
        testResults[lang] = langResults;

        const reviewFlags = { ...(prev.reviewFlags || {}) };
        const langMap = { ...(reviewFlags[lang] || {}) };
        langMap[monthId] = { ...(langMap[monthId] || {}), vocab: true };
        reviewFlags[lang] = langMap;

        let next = withPracticeSession({ ...prev, testResults, reviewFlags }, record);
        const nowDone = isMonthDone(next, lang, monthId);
        next = withActivity(next, record.correct + (nowDone && !wasDone ? 20 : 0), { answers: record.answered, lessons: nowDone && !wasDone ? 1 : 0 });
        return next;
      });
    },
    [lang, monthId, updateProgress, retryItems]
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
  if (!month) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">{t('Dars topilmadi.')}</div>
        </div>
      </Layout>
    );
  }

  const pct = result?.total ? Math.round((result.correct / result.total) * 100) : 0;
  const flat = flattenMonths(data.modules);
  const nextLesson = flat[flat.findIndex((m) => m.id === monthId) + 1];
  const done = isMonthDone(progress, lang, monthId);

  return (
    <Layout>
      <div className="page-narrow">
        <Link to={`/lang/${lang}/month/${moduleId}/${monthId}`} className="back-link mb-4">
          ← {t(month.topic)}
        </Link>

        {!result ? (
          <PracticeSession
            key={round}
            items={retryItems || items}
            pool={pool}
            lang={lang}
            mode="mixed"
            count={retryItems ? 0 : 25}
            title={retryItems ? `Xatolar ustida ishlash · ${month.topic}` : `Dars testi · ${month.topic}`}
            source={retryItems ? 'mistakes' : 'lesson-test'}
            label={retryItems ? `Xatolar: ${month.topic}` : `Dars testi: ${month.label} · ${month.topic}`}
            strict={!retryItems}
            extra={{ lessonId: monthId }}
            onFinish={onFinish}
          />
        ) : (
          <>
            {!retryItems && (
              <div className={`alert mb-4 ${pct >= QUIZ_PASS_THRESHOLD ? 'alert-success' : 'alert-warn'}`}>
                {pct >= QUIZ_PASS_THRESHOLD
                  ? `${t('✅ {pct}% — dars testi topshirildi!', { pct })}${done ? ` ${t("Dars to'liq yakunlandi.")}` : ` ${t('Darsning qolgan bosqichlarini ham yakunlang.')}`}`
                  : t("{pct}% — darsni yakunlash uchun kamida {min}% kerak. Xatolarni takrorlab, qayta urinib ko'ring.", { pct, min: QUIZ_PASS_THRESHOLD })}
              </div>
            )}
            <PracticeResult
              record={result}
              onRetryMistakes={(list) => {
                setRetryItems(list.map((x) => ({ w: x.w, t: x.t, m: x.m, s: x.s, st: x.st })));
                setResult(null);
                setRound((r) => r + 1);
              }}
              onRestart={() => {
                setRetryItems(null);
                setResult(null);
                setRound((r) => r + 1);
              }}
              extraActions={
                <>
                  <Link to={`/lang/${lang}/month/${moduleId}/${monthId}`} className="btn btn-ghost">
                    {t('Darsga qaytish')}
                  </Link>
                  {done && nextLesson && (
                    <Link to={`/lang/${lang}/month/${nextLesson.moduleId}/${nextLesson.id}`} className="btn btn-brand">
                      {t('Keyingi dars →')}
                    </Link>
                  )}
                </>
              }
            />
          </>
        )}
      </div>
    </Layout>
  );
}
