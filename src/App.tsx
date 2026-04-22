import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { WorkspaceProvider } from '@/hooks/useWorkspace';
import { ToastProvider } from '@/hooks/useToast';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Categories from '@/pages/Categories';
import PaymentSources from '@/pages/PaymentSources';
import Spends from '@/pages/Spends';
import Contacts from '@/pages/Contacts';
import LoansGiven from '@/pages/LoansGiven';
import LoansTaken from '@/pages/LoansTaken';
import LoanDetail from '@/pages/LoanDetail';
import WorkspaceSettings from '@/pages/WorkspaceSettings';
import ProfileSettings from '@/pages/ProfileSettings';
import BackupSettings from '@/pages/BackupSettings';
import AdminLogs from '@/pages/AdminLogs';
import Notes from '@/pages/Notes';
import Investments from '@/pages/Investments';
import InvestmentTypes from '@/pages/InvestmentTypes';

export default function App() {
  return (
    <ToastProvider>
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
            <Route path="/spends" element={<Spends />} />
            <Route path="/loans-given" element={<LoansGiven />} />
            <Route path="/loans-taken" element={<LoansTaken />} />
            <Route path="/loan/:id" element={<LoanDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/investment-types" element={<InvestmentTypes />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/payment-sources" element={<PaymentSources />} />
            <Route path="/settings/workspace" element={<WorkspaceSettings />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/backup" element={<BackupSettings />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
