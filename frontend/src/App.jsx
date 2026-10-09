import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { TutorProvider } from './context/TutorContext.jsx';
import { I18nProvider, LangBoundary } from './i18n/react.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';

// Kamroq ishlatiladigan sahifalar alohida yuklanadi — telefonda birinchi ochilish tezroq bo'ladi
const RoutePage = lazy(() => import('./pages/RoutePage.jsx'));
const MonthPage = lazy(() => import('./pages/MonthPage.jsx'));
const VocabPractice = lazy(() => import('./pages/VocabPractice.jsx'));
const VocabPracticeFull = lazy(() => import('./pages/VocabPracticeFull.jsx'));
const ResultsPage = lazy(() => import('./pages/ResultsPage.jsx'));
const FullDictionaryPage = lazy(() => import('./pages/FullDictionaryPage.jsx'));
const DialogsPage = lazy(() => import('./pages/DialogsPage.jsx'));
const GrammarPage = lazy(() => import('./pages/GrammarPage.jsx'));
const VerbsPage = lazy(() => import('./pages/VerbsPage.jsx'));
const MediaPage = lazy(() => import('./pages/MediaPage.jsx'));
const AiTutorPage = lazy(() => import('./pages/AiTutorPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center app-bg">
      <span className="spinner" style={{ color: 'var(--pine)' }} />
    </div>
  );
}

const protect = (el, staff = false) => <ProtectedRoute staff={staff}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <TutorProvider>
          <BrowserRouter>
            <LangBoundary>
              <Suspense fallback={<Fallback />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/" element={protect(<Dashboard />)} />
                  <Route path="/lang/:lang" element={protect(<RoutePage />)} />
                  <Route path="/lang/:lang/month/:moduleId/:monthId" element={protect(<MonthPage />)} />
                  <Route path="/lang/:lang/practice/:moduleId/:monthId" element={protect(<VocabPractice />)} />
                  <Route path="/lang/:lang/practice-full" element={protect(<VocabPracticeFull />)} />
                  <Route path="/lang/:lang/dictionary" element={protect(<FullDictionaryPage />)} />
                  <Route path="/lang/:lang/dialogs" element={protect(<DialogsPage />)} />
                  <Route path="/lang/:lang/grammar" element={protect(<GrammarPage />)} />
                  <Route path="/lang/:lang/verbs" element={protect(<VerbsPage />)} />
                  <Route path="/results" element={protect(<ResultsPage />)} />
                  <Route path="/media/:kind" element={protect(<MediaPage />)} />
                  <Route path="/ai" element={protect(<AiTutorPage />)} />
                  <Route path="/profile" element={protect(<ProfilePage />)} />
                  <Route path="/admin" element={protect(<AdminPage />, true)} />
                  <Route path="/library" element={<Navigate to="/media/text" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </LangBoundary>
          </BrowserRouter>
        </TutorProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
