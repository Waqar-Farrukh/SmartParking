import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';

// Layout & Auth
import Auth from './pages/Auth';
import Layout from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import NewBooking from './pages/NewBooking';
import MyBookings from './pages/MyBookings';
import Violations from './pages/Violations';
import LoyaltyRewards from './pages/LoyaltyRewards';
import Reports from './pages/Reports';
import Wallet from './pages/Wallet';
import Leaderboard from './pages/Leaderboard';
import AdminDashboard from './pages/AdminDashboard';

function AdminRoute({ children }) {
  const { isAdmin } = useAppContext();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="book" element={<NewBooking />} />
            <Route path="my-bookings" element={<MyBookings />} />
            <Route path="violations" element={<Violations />} />
            <Route path="loyalty" element={<LoyaltyRewards />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
            <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
