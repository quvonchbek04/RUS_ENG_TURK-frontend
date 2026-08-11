import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, booting } = useAuth();
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="font-mono text-sm tracking-widest uppercase" style={{ color: 'var(--ink-soft)' }}>
          Yuklanmoqda…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
