import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { WorkspaceProvider } from '@/hooks/useWorkspace';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Placeholder from '@/pages/Placeholder';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <WorkspaceProvider>
                <Layout />
              </WorkspaceProvider>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/spends" element={<Placeholder title="Spends" />} />
          <Route path="/loans-given" element={<Placeholder title="Loans Given" />} />
          <Route path="/loans-taken" element={<Placeholder title="Loans Taken" />} />
          <Route path="/contacts" element={<Placeholder title="Contacts" />} />
          <Route path="/categories" element={<Placeholder title="Categories" />} />
          <Route path="/payment-sources" element={<Placeholder title="Payment Sources" />} />
          <Route path="/settings/workspace" element={<Placeholder title="Workspace Settings" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
