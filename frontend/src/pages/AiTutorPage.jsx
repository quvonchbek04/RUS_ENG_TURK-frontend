import Layout from '../components/Layout.jsx';
import AiTutorPanel from '../components/AiTutorPanel.jsx';
import { PageHeader } from '../components/ui.jsx';

const TIPS = [
  ['✍️', "Gapingizni tekshirting", '«Gapimni tekshir: I has two brother» — ustoz xatoni tuzatib, sababini tushuntiradi.'],
  ['📐', 'Grammatikani so\'rang', "«Present Perfect qachon ishlatiladi?» — sodda misollar bilan tushuntirib beradi."],
  ['🗣️', 'Suhbat mashqi', "«Keling, restoranda buyurtma berishni mashq qilamiz» — rolli o'yin."],
  ['🎙️', 'Ovoz bilan yozing', "Mikrofon tugmasini bosing va o'rganayotgan tilingizda gapiring."],
  ['🧪', 'Test so\'rang', "«Menga 5 ta savol ber» — o'zingizni sinab ko'ring."],
];

export default function AiTutorPage() {
  return (
    <Layout>
      <div className="page-wide">
        <PageHeader eyebrow="Shaxsiy ustoz" title="🤖 AI ustoz" subtitle="Savollaringizga o'zbek tilida javob beradi, xatolaringizni tuzatadi va siz bilan suhbat mashqi qiladi." />
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="h-[calc(100vh-260px)] min-h-[520px] lg:h-[calc(100vh-220px)]">
            <AiTutorPanel />
          </div>
          <aside className="space-y-3">
            <div className="eyebrow">Qanday foydalanish</div>
            {TIPS.map(([icon, title, text]) => (
              <div key={title} className="card p-4">
                <div className="font-bold text-sm mb-1" style={{ color: 'var(--ink)' }}>
                  {icon} {title}
                </div>
                <div className="text-sm muted">{text}</div>
              </div>
            ))}
            <div className="text-xs faint">Klaviatura: Ctrl/⌘ + K — istalgan sahifada AI ustozni ochish.</div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
