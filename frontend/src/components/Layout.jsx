import Sidebar from './Sidebar.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--paper)' }}>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: 'var(--paper)' }}>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6" style={{ borderColor: 'var(--line)' }}>
          <div className="max-w-[1440px] mx-auto px-5 font-mono text-[11px] tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Til sayohati · mahalliy muhitda ishlaydigan o'quv platformasi
          </div>
        </footer>
      </div>
    </div>
  );
}
