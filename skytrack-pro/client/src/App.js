import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import DayWiseView from './pages/DayWiseView';
import PendingShipments from './pages/PendingShipments';
import DeliveredShipments from './pages/DeliveredShipments';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <ToastProvider>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/upload" element={<Layout><UploadPage /></Layout>} />
          <Route path="/day-wise" element={<Layout><DayWiseView /></Layout>} />
          <Route path="/pending" element={<Layout><PendingShipments /></Layout>} />
          <Route path="/delivered" element={<Layout><DeliveredShipments /></Layout>} />
          <Route path="/notifications" element={<Layout><NotificationsPage /></Layout>} />
          <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </ToastProvider>
  );
    }
