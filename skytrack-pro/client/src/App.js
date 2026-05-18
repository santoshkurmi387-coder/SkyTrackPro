import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import DayWiseView from './pages/DayWiseView';
import PendingShipments from './pages/PendingShipments';
import DeliveredShipments from './pages/DeliveredShipments';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/upload" element={
        <PrivateRoute>
          <Layout>
            <UploadPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/day-wise" element={
        <PrivateRoute>
          <Layout>
            <DayWiseView />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/pending" element={
        <PrivateRoute>
          <Layout>
            <PendingShipments />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/delivered" element={
        <PrivateRoute>
          <Layout>
            <DeliveredShipments />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/notifications" element={
        <PrivateRoute>
          <Layout>
            <NotificationsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute>
          <Layout>
            <SettingsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
