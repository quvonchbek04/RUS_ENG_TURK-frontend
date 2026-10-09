import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminRole } from '../lib/lessonProgress.js';
import Layout from './Layout.jsx';
import { EmptyState } from './ui.jsx';

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 app-bg">
      <img src="/icon.svg" alt="" className="w-16 h-16 rounded-2xl" style={{ boxShadow: 'var(--shadow-lg)' }} />
      <div className="flex items-center gap-2 text-sm muted">
        <span className="spinner" /> Yuklanmoqda…
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, staff = false }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (staff && !isAdminRole(user.role)) {
    return (
      <Layout>
        <div className="page-narrow">
          <EmptyState icon="🔒" title="Ruxsat yo'q" text="Bu sahifa faqat administratorlar uchun." />
        </div>
      </Layout>
    );
  }
  return children;
}
