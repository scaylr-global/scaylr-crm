import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Pipeline from './pages/Pipeline';
import FollowUps from './pages/FollowUps';
import TeamTargets from './pages/TeamTargets';
import ActivityLog from './pages/ActivityLog';
import UserMgmt from './pages/UserMgmt';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-muted">Loading…</div>
    );
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/leads" element={<Protected><Leads /></Protected>} />
      <Route path="/leads/:id" element={<Protected><LeadDetail /></Protected>} />
      <Route path="/pipeline" element={<Protected><Pipeline /></Protected>} />
      <Route path="/followups" element={<Protected><FollowUps /></Protected>} />
      <Route path="/targets" element={<Protected><TeamTargets /></Protected>} />
      <Route path="/activity" element={<Protected><ActivityLog /></Protected>} />
      <Route path="/users" element={<Protected><UserMgmt /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
