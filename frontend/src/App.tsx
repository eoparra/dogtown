import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ClientLayout, AdminLayout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Landing Page (keep eager — it's the entry point)
import LandingPage from '@/pages/LandingPage';

// Lazy-loaded pages
const RegisterPage = lazy(() => import('@/pages/client/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/client/DashboardPage'));
const DogsPage = lazy(() => import('@/pages/client/DogsPage'));
const BookingsPage = lazy(() => import('@/pages/client/BookingsPage'));
const NewBookingPage = lazy(() => import('@/pages/client/NewBookingPage'));

const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const AdminDogsPage = lazy(() => import('@/pages/admin/DogsPage'));
const AdminBookingsPage = lazy(() => import('@/pages/admin/BookingsPage'));
const AdminRatesPage = lazy(() => import('@/pages/admin/RatesPage'));
const AdminCapacityPage = lazy(() => import('@/pages/admin/CapacityPage'));
const AdminPeriodsPage = lazy(() => import('@/pages/admin/PeriodsPage'));
const AdminInventoryProductsPage = lazy(() => import('@/pages/admin/InventoryPage'));
const AdminInventoryServicesPage = lazy(() => import('@/pages/admin/ServicesPage'));
const AdminCreateClientPage = lazy(() => import('@/pages/admin/CreateClientPage'));

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Loading"></div>
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  if (!user) {
    return <Navigate to="/?login=true" replace />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Login redirects to landing page with modal */}
        <Route path="/login" element={<PublicRoute><Navigate to="/?login=true" replace /></PublicRoute>} />
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

        <Route path="/admin/inventory" element={<Navigate to="/admin/inventory/products" replace />} />
        <Route path="/admin/inventory/products" element={
          <ProtectedRoute adminOnly>
            <AdminLayout><AdminInventoryProductsPage /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/inventory/services" element={
          <ProtectedRoute adminOnly>
            <AdminLayout><AdminInventoryServicesPage /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/clients/new" element={
          <ProtectedRoute adminOnly>
            <AdminLayout><AdminCreateClientPage /></AdminLayout>
          </ProtectedRoute>
        } />

        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
