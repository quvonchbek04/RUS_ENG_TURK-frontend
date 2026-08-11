import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RoutePage from './pages/RoutePage.jsx';
import MonthPage from './pages/MonthPage.jsx';
import VocabPractice from './pages/VocabPractice.jsx';
import Library from './pages/Library.jsx';
import DialogsPage from './pages/DialogsPage.jsx';
import GrammarPage from './pages/GrammarPage.jsx';
import VerbsPage from './pages/VerbsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import VocabPracticeFull from './pages/VocabPracticeFull.jsx';
import FullDictionaryPage from './pages/FullDictionaryPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang"
            element={
              <ProtectedRoute>
                <RoutePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/month/:moduleId/:monthId"
            element={
              <ProtectedRoute>
                <MonthPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/practice/:moduleId/:monthId"
            element={
              <ProtectedRoute>
                <VocabPractice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/dialogs"
            element={
              <ProtectedRoute>
                <DialogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/grammar"
            element={
              <ProtectedRoute>
                <GrammarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/verbs"
            element={
              <ProtectedRoute>
                <VerbsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/practice-full"
            element={
              <ProtectedRoute>
                <VocabPracticeFull />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lang/:lang/dictionary"
            element={
              <ProtectedRoute>
                <FullDictionaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
