import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ClientLayout, AdminLayout } from '@/components/Layout';

// Client Pages
import LoginPage from '@/pages/client/LoginPage';
import RegisterPage from '@/pages/client/RegisterPage';
import DashboardPage from '@/pages/client/DashboardPage';
import DogsPage from '@/pages/client/DogsPage';
import BookingsPage from '@/pages/client/BookingsPage';
import NewBookingPage from '@/pages/client/NewBookingPage';

// Admin Pages
import AdminDashboardPage from '@/pages/admin/DashboardPage';
import AdminUsersPage from '@/pages/admin/UsersPage';
import AdminDogsPage from '@/pages/admin/DogsPage';
import AdminBookingsPage from '@/pages/admin/BookingsPage';
import AdminRatesPage from '@/pages/admin/RatesPage';
import AdminCapacityPage from '@/pages/admin/CapacityPage';
import AdminPeriodsPage from '@/pages/admin/PeriodsPage';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Client routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <ClientLayout><DashboardPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/dogs" element={
        <ProtectedRoute>
          <ClientLayout><DogsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/bookings" element={
        <ProtectedRoute>
          <ClientLayout><BookingsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/new-booking" element={
        <ProtectedRoute>
          <ClientLayout><NewBookingPage /></ClientLayout>
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminDashboardPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminUsersPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/dogs" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminDogsPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/bookings" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminBookingsPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/rates" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminRatesPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/capacity" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminCapacityPage /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/periods" element={
        <ProtectedRoute adminOnly>
          <AdminLayout><AdminPeriodsPage /></AdminLayout>
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
