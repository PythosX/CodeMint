import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './layouts/AppLayout';
import Landing from './pages/Landing'; import Auth from './pages/Auth'; import Dashboard from './pages/Dashboard'; import Projects from './pages/Projects'; import NewAnalysis from './pages/NewAnalysis'; import ScanPage from './pages/Scan';
function Protected({ children }: { children: JSX.Element }) { const { session, loading } = useAuth(); if (loading) return null; return session ? children : <Navigate to="/login" replace />; }
export default function App() {
  return (<Routes><Route path="/" element={<Landing />} /><Route path="/login" element={<Auth mode="login" />} /><Route path="/register" element={<Auth mode="register" />} />
    <Route path="/app" element={<Protected><AppLayout /></Protected>}><Route index element={<Dashboard />} /><Route path="projects" element={<Projects />} /><Route path="new" element={<NewAnalysis />} /><Route path="scans/:id" element={<ScanPage />} /></Route>
    <Route path="*" element={<Navigate to="/" />} /></Routes>);
}
